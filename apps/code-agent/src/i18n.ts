/** 组件内部标签的双语映射：中文表意 + 原始标识（等宽）。 */

export const ROLE_LABEL: Record<string, string> = {
  "Chief Architect": "首席架构师",
  "Contract Builder": "契约工程师",
  "Database Builder": "数据库工程师",
  "Backend Builder": "后端工程师",
  "Frontend Builder": "前端工程师",
  "Seed Data Builder": "种子数据工程师",
  "Skill Integrator": "技能集成工程师",
  Judge: "裁判官",
  "Red Agent": "红军",
  "Blue Agent": "蓝军",
  "Visual Agent": "视觉巡航",
  Archiver: "归档师",
}

/** 护栏：中文名 + 中文解释（英文标识保留在第二行）。 */
export const RAIL_INFO: Record<string, { zh: string; en: string }> = {
  ForbiddenMemoryRail: { zh: "禁止记忆读取", en: "角色访问控制：裁判不得读取实现源码" },
  ContextRedactionRail: { zh: "上下文脱敏", en: "敏感字段进入模型前掩码或阻断" },
  PermissionInterruptRail: { zh: "人工审批中断", en: "未批准不得写入业务代码" },
  ContractVerifyRail: { zh: "契约一致性校验", en: "路由、字段、RBAC 与 data-panshi-id" },
  CodingMemoryRail: { zh: "编码规范注入", en: "政企底座与编码基线" },
  BudgetRail: { zh: "预算护栏", en: "超出预算的角色暂停执行" },
  AuditRail: { zh: "审计留痕", en: "每次阻断写入事件日志" },
}

export const EVENT_LABEL: Record<string, string> = {
  "task.created": "任务创建",
  "plan.ready": "计划就绪",
  "plan.rejected": "计划被拒",
  "approval.requested": "请求审批",
  "approval.resolved": "审批完成",
  "run.queued": "排队",
  "run.started": "开始执行",
  "run.interrupted": "执行中断",
  "run.succeeded": "执行成功",
  "run.failed": "执行失败",
  "run.cancelled": "执行取消",
  "checkpoint.created": "创建检查点",
  "checkpoint.restored": "恢复检查点",
  "tool.started": "调用工具",
  "tool.finished": "工具返回",
  "patch.created": "生成补丁",
  "check.started": "检查开始",
  "check.finished": "检查完成",
  "verification.started": "开始验证",
  "provider.error": "模型错误",
  "system.note": "系统提示",
  "stage.started": "工段开始",
  "stage.completed": "工段完成",
  "stage.failed": "工段失败",
  "stage.skipped": "工段不适用",
  "artifact.created": "产物生成",
  "baseline.manifest": "资产清单",
  "baseline.secretScan": "敏感信息扫描",
  "baseline.environment": "环境摘要",
  "greenbuild.diagnosis": "构建诊断",
  "greenbuild.conflicts": "依赖冲突",
  "greenbuild.verdict": "运行判定",
  "archaeology.slice": "代码切片",
  "archaeology.rule": "业务规则",
  "archaeology.unanalyzed": "未分析项",
  "decompile.symbols": "符号提取",
  "decompile.diff": "差分对拍",
  "decompile.equivalence": "等价结论",
  "skill.build": "技能构建",
  "skill.harness": "技能验毒",
  "skill.license": "许可证扫描",
  "skill.register": "技能注册",
  "clarify.message": "需求澄清",
  "contract.validate": "契约校验",
  "contract.locked": "契约锁定",
  "role.run.started": "角色启动",
  "role.run.finished": "角色完成",
  "role.merge": "角色合并",
  "rail.violation": "护栏阻断",
  "attack.finding": "攻击发现",
  "judge.invariant": "不变量判定",
  "cruise.step": "巡航步骤",
  "cruise.error": "巡航错误",
  "cruise.replay": "巡航重跑",
  "delivery.report": "交付报告",
  "rsi.evolution": "经验沉淀",
}

export const ARTIFACT_LABEL: Record<string, string> = {
  "project-manifest.json": "项目资产清单",
  "secret-scan.json": "敏感信息扫描",
  "environment.json": "环境摘要",
  "environment-diagnosis.md": "环境诊断",
  "run-verdict.json": "运行判定",
  "build.log": "构建日志",
  "code-slices.json": "代码切片",
  "business-rules.json": "业务规则",
  "call-graph.json": "调用图",
  "unanalyzed.json": "未分析项",
  "SKILL.md": "技能说明",
  "wrapper.mjs": "调用封装",
  "harness-report.json": "验毒报告",
  "skillhub-pr.md": "SkillHub PR 草稿",
  "schema.sql": "数据库契约",
  "openapi.yaml": "接口契约",
  "component_tree.json": "组件树契约",
  "contract-bundle.json": "契约锁定包",
  "rail-report.json": "护栏报告",
  "rail-stats.json": "护栏统计",
  "attack-report.json": "攻击报告",
  "invariants.json": "不变量结果",
  "repair-diff.patch": "修复差异",
  "delivery-report.json": "交付报告",
  "evolution-skillpack.md": "进化技能包",
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role
}

export function railLabel(name: string): string {
  return RAIL_INFO[name]?.zh ?? name
}

export function railDescription(name: string, fallback: string): string {
  return RAIL_INFO[name]?.en ?? fallback
}

export function eventLabel(type: string): string {
  return EVENT_LABEL[type] ?? type
}

export function artifactLabel(name: string): string {
  return ARTIFACT_LABEL[name] ?? name
}
