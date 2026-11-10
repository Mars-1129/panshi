import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { acquireTaskLock, peekTaskLock, TaskLockError } from "../../server/core/factory/task-lock.ts"

async function freshDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "task-lock-"))
}

describe("task-lock · 跨进程任务互斥", () => {
  it("第一次能拿到锁", async () => {
    const dir = await freshDir()
    const lock = await acquireTaskLock(dir, 3)
    expect(typeof lock.release).toBe("function")
    await lock.release()
  })

  it("锁被持有时第二次获取失败，并给出持有者信息", async () => {
    const dir = await freshDir()
    const lock = await acquireTaskLock(dir, 5)
    await expect(acquireTaskLock(dir, 6)).rejects.toBeInstanceOf(TaskLockError)
    try {
      await acquireTaskLock(dir, 6)
    } catch (error) {
      const info = (error as TaskLockError).holder
      expect(info?.pid).toBe(process.pid)
      expect(info?.stage).toBe(5)
    }
    await lock.release()
  })

  it("释放后可以重新获取", async () => {
    const dir = await freshDir()
    const first = await acquireTaskLock(dir, 1)
    await first.release()
    const second = await acquireTaskLock(dir, 2)
    await second.release()
  })

  it("重复 release 不会报错，也不会删掉别人的锁", async () => {
    const dir = await freshDir()
    const lock = await acquireTaskLock(dir, 1)
    await lock.release()
    await expect(lock.release()).resolves.toBeUndefined()

    const next = await acquireTaskLock(dir, 2)
    expect(await peekTaskLock(dir)).not.toBeNull()
    await next.release()
  })

  it("陈旧锁（持有进程已死）会被接管", async () => {
    const dir = await freshDir()
    // 伪造一个不存在的 pid 持有的锁
    await writeFile(
      join(dir, ".task.lock"),
      JSON.stringify({ pid: 999999, acquiredAt: new Date(0).toISOString(), stage: 4 }),
      "utf8",
    )
    const lock = await acquireTaskLock(dir, 7)
    expect(lock).toBeTruthy()
    const raw = JSON.parse(await readFile(join(dir, ".task.lock"), "utf8")) as { pid: number }
    expect(raw.pid).toBe(process.pid)
    await lock.release()
  })

  it("peek 对已释放的锁返回 null", async () => {
    const dir = await freshDir()
    const lock = await acquireTaskLock(dir, 1)
    expect(await peekTaskLock(dir)).not.toBeNull()
    await lock.release()
    expect(await peekTaskLock(dir)).toBeNull()
  })

  it("peek 对死进程留下的锁返回 null（界面不会一直显示排队）", async () => {
    const dir = await freshDir()
    await writeFile(
      join(dir, ".task.lock"),
      JSON.stringify({ pid: 999999, acquiredAt: new Date(0).toISOString(), stage: 1 }),
      "utf8",
    )
    expect(await peekTaskLock(dir)).toBeNull()
  })

  it("锁文件损坏时不会崩，当作未持有处理", async () => {
    const dir = await freshDir()
    await writeFile(join(dir, ".task.lock"), "not json", "utf8")
    const lock = await acquireTaskLock(dir, 2)
    expect(lock).toBeTruthy()
    await lock.release()
  })
})
