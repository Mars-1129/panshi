import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

/**
 * 任务级磁盘锁。
 *
 * 进程内的 Map / Semaphore 只在单进程内有效：`pnpm dev` 起的服务与命令行
 * 同时驱动同一个任务时，两边各持一把锁，谁也不知道对方在跑。结果是同一工段
 * 被并发写，产物互相覆盖，事件日志出现交错的 seq。
 *
 * 这里用「独占创建锁文件」实现跨进程互斥：
 *   - `open(path, "wx")` 在文件已存在时失败，是原子的
 *   - 锁文件里记录 pid 与获得时间，用于判断持有者是否还活着
 *   - 持有者进程消失（pid 不存在）或超过 maxAgeMs 时视为陈旧锁，可以接管
 *
 * 注意这不是分布式锁：只在同一台机器、同一个文件系统上有效。跨机器部署需要
 * 数据库行锁或外部分布式锁服务。
 */

export type TaskLockInfo = {
  pid: number
  acquiredAt: string
  stage: number
}

export class TaskLockError extends Error {
  readonly code = "task_locked"
  readonly holder: TaskLockInfo | null

  constructor(holder: TaskLockInfo | null) {
    super(
      holder
        ? `任务正在被另一个进程执行（pid ${holder.pid}，工段 ${holder.stage}，开始于 ${holder.acquiredAt}）`
        : "任务正在被另一个进程执行",
    )
    this.name = "TaskLockError"
    this.holder = holder
  }
}

function lockPath(runDir: string): string {
  return join(runDir, ".task.lock")
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    // 信号 0 不实际发送信号，只探测进程是否存在
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

async function readLock(runDir: string): Promise<TaskLockInfo | null> {
  try {
    const raw = await readFile(lockPath(runDir), "utf8")
    const parsed = JSON.parse(raw) as Partial<TaskLockInfo>
    if (typeof parsed.pid !== "number") return null
    return {
      pid: parsed.pid,
      acquiredAt: typeof parsed.acquiredAt === "string" ? parsed.acquiredAt : "",
      stage: typeof parsed.stage === "number" ? parsed.stage : -1,
    }
  } catch {
    return null
  }
}

/** 锁文件是否已经没人持有（进程死了，或者太老）。 */
async function isStale(runDir: string, info: TaskLockInfo, maxAgeMs: number): Promise<boolean> {
  if (!isProcessAlive(info.pid)) return true
  try {
    const info2 = await stat(lockPath(runDir))
    return Date.now() - info2.mtimeMs > maxAgeMs
  } catch {
    return true
  }
}

export type AcquiredLock = {
  release: () => Promise<void>
}

/**
 * 尝试获取任务锁。拿不到时抛 TaskLockError，由调用方转成 409。
 * 陈旧锁会被接管（上一个持有者已经崩了）。
 */
export async function acquireTaskLock(
  runDir: string,
  stage: number,
  options: { maxAgeMs?: number } = {},
): Promise<AcquiredLock> {
  const maxAgeMs = options.maxAgeMs ?? 30 * 60 * 1000
  const path = lockPath(runDir)
  await mkdir(dirname(path), { recursive: true })

  const payload = JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString(), stage })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(path, "wx")
      try {
        await handle.writeFile(payload, "utf8")
      } finally {
        await handle.close()
      }
      let released = false
      return {
        release: async () => {
          if (released) return
          released = true
          const current = await readLock(runDir)
          // 只删自己的锁：接管场景下可能已经是别人的
          if (current && current.pid === process.pid) {
            await unlink(path).catch(() => undefined)
          }
        },
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      const holder = await readLock(runDir)
      // 读不出持有者（文件损坏 / 空文件）等同于没人能证明自己持有它，
      // 按陈旧锁处理——否则一个坏掉的锁文件会让任务永久不可执行。
      if (!holder || (await isStale(runDir, holder, maxAgeMs))) {
        await unlink(path).catch(() => undefined)
        continue
      }
      throw new TaskLockError(holder)
    }
  }
  throw new TaskLockError(await readLock(runDir))
}

/** 只读查询：当前锁被谁持有（用于界面显示"排队中"）。 */
export async function peekTaskLock(runDir: string): Promise<TaskLockInfo | null> {
  const info = await readLock(runDir)
  if (!info) return null
  // 死进程留下的锁不算"有人持有"
  if (!isProcessAlive(info.pid)) return null
  return info
}
