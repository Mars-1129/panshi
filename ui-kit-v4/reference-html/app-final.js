// UI and browser-local demo controller. Backend integrations are intentionally explicit.
(() => {
  'use strict';
  // Original sample content; no network API or backend is implied.
  const API = {
  "agents": [
    {
      "name": "考古官",
      "desc": "读取存量代码与诊断信息。",
      "job": "scan"
    },
    {
      "name": "架构师",
      "desc": "梳理角色、审批流程与契约边界。",
      "job": "chat"
    },
    {
      "name": "数据库 Agent",
      "desc": "整理数据库表与仿真数据。",
      "job": "build",
      "lane": 0
    },
    {
      "name": "后端 Agent",
      "desc": "制造服务端路由与权限校验。",
      "job": "build",
      "lane": 1
    },
    {
      "name": "前端 Agent",
      "desc": "构建界面并装配技能。",
      "job": "build",
      "lane": 2
    },
    {
      "name": "技能装配 Agent",
      "desc": "把发票核验与库存锁技能装配进交付物。",
      "job": "build",
      "lane": 3
    },
    {
      "name": "红军专家",
      "desc": "模拟并发攻击与越权场景。",
      "job": "qa"
    },
    {
      "name": "视觉巡航",
      "desc": "模拟浏览器巡航与审批步骤。",
      "job": "qa"
    },
    {
      "name": "蓝军修复",
      "desc": "展示修复与回归测试过程。",
      "job": "qa"
    }
  ],
  "stage1": {
    "steps": [
      { "name": "接入资产", "key": "sources", "hint": "登记项目与工具来源" },
      { "name": "扫描诊断", "key": "scan", "hint": "识别技术债与业务规则" },
      { "name": "工具转化", "key": "mcp", "hint": "整理为标准技能包" },
      { "name": "语义还原", "key": "code", "hint": "读懂并重构遗产代码" }
    ],
    "stats": [
      { "label": "已接入资产", "key": "sources", "unit": "项", "live": true },
      { "label": "核心业务表", "value": 43, "unit": "张" },
      { "label": "待处理高危漏洞", "value": 12, "unit": "个", "risk": true },
      { "label": "无源码模块", "value": 1, "unit": "个" }
    ],
    "cards": [
      {
        "data": [
          {
            "label": "技术栈",
            "value": "Struts 1.x + JSP + Hibernate"
          },
          {
            "label": "JDK 版本",
            "value": "JDK 6 已废弃",
            "badge": "warning"
          },
          {
            "label": "数据库表",
            "value": "43 张核心业务表"
          },
          {
            "label": "CVE 漏洞",
            "value": "12 个高危",
            "badge": "danger"
          },
          {
            "label": "无源码文件",
            "value": "libdepreciation.so"
          }
        ]
      },
      {
        "before": "// 原始反编译代码\nint sub_4012A0(int v1, int v2) {\n  int v3 = v1 * v2;\n  if (v3 > 1000) {\n    v3 = v3 / 12;\n  }\n  return v3;\n}"
      }
    ]
  },
  "stage2": {
    "cards": [
      {
        "messages": [
          {
            "role": "architect",
            "text": "我从老国企采购系统中识别出 43 张核心业务表和 3 级审批流。请问：\n1. 是否保留该 3 级审批流程？\n2. 是否需要将【发票 OCR 核验 Skill】设为处长初审前的强制拦截条件？"
          },
          {
            "role": "user",
            "text": "保留 3 级审批，并在处长初审前强制调用发票核验。另外增加一个\"紧急采购\"快速通道。"
          },
          {
            "role": "architect",
            "text": "明白。系统预设包含哪几个角色？哪些角色可以导出敏感财务报表？"
          }
        ]
      }
    ]
  },
  "stage3": {
    "swarms": [
      {
        "name": "数据库 Agent",
        "output": [
          { "done": true, "text": "schema.sql（43 张核心业务表）" },
          { "done": true, "text": "100 条仿真数据" }
        ]
      },
      {
        "name": "后端微服务 Agent",
        "output": [
          { "done": true, "text": "FastAPI 路由 (18/24)" },
          { "done": false, "text": "RBAC 权限装饰器" }
        ]
      },
      {
        "name": "前端界面 Agent",
        "output": [
          { "done": true, "text": "Vue 3 组件 (12/20)" },
          { "done": false, "text": "表格与表单" }
        ]
      },
      {
        "name": "技能装配 Agent",
        "output": [
          { "done": true, "text": "发票核验 Skill 集成" },
          { "done": false, "text": "docker-compose.yml" }
        ]
      }
    ],
    "code": "# backend/routers/procurement.py (实时生成中)\n\n@router.post(\"/procurement/orders\")\n@require_rbac_permission(\"procurement:create\")\nasync def create_order(\n    order: ProcurementOrderCreate,\n    current_user: User = Depends(get_current_user)\n):\n    \"\"\"创建采购单（带悲观锁防并发）\"\"\"\n    async with db.begin():\n        # 1. 检查库存（悲观锁）\n        item = await db.execute(\n            select(Item)\n            .where(Item.id == order.item_id)\n            .with_for_update()  # 行级锁\n        )\n\n        if item.stock < order.quantity:\n            raise HTTPException(400, \"库存不足\")\n\n        # 2. 调用发票核验 Skill\n        invoice_result = await skill_invoker.call(\n            \"soe-vat-invoice-mcp-verifier\",\n            invoice_file=order.invoice_file\n        )\n\n        if not invoice_result.is_authentic:\n            raise HTTPException(400, \"发票核验失败\")\n\n        # 3. 创建订单并扣减库存\n        new_order = ProcurementOrder(**order.dict())\n        db.add(new_order)\n        item.stock -= order.quantity\n\n    return new_order",
    "guardLogs": [
      {
        "text": "路由 /procurement/orders 匹配契约"
      },
      {
        "text": "RBAC 装饰器已添加"
      },
      {
        "text": "响应字段与 openapi.yaml 一致"
      }
    ],
    "files": [
      {
        "lane": 0,
        "path": "backend/db/schema.sql",
        "lang": "sql",
        "label": "数据库契约",
        "code": "-- 磐石智造 · 采购模块（制造产物）\nCREATE TABLE procurement_orders (\n  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  item_name VARCHAR(160) NOT NULL,\n  quantity INTEGER NOT NULL CHECK (quantity > 0),\n  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),\n  approval_level INTEGER NOT NULL DEFAULT 1 CHECK (approval_level BETWEEN 1 AND 3),\n  invoice_verified BOOLEAN NOT NULL DEFAULT FALSE,\n  urgent BOOLEAN NOT NULL DEFAULT FALSE,\n  status VARCHAR(24) NOT NULL DEFAULT 'pending'\n);\n\nINSERT INTO procurement_orders\n  (item_name, quantity, total_amount, approval_level, urgent, status)\nVALUES\n  ('办公桌椅', 50, 87500, 1, FALSE, 'pending'),\n  ('打印机耗材', 20, 12800, 1, FALSE, 'pending'),\n  ('服务器设备', 3, 456000, 3, TRUE, 'pending');"
      },
      {
        "lane": 0,
        "path": "backend/db/seed.py",
        "lang": "python",
        "label": "仿真数据脚本",
        "code": "# 生成 100 条仿真采购单\nimport random\nfrom datetime import date, timedelta\n\nitems = [\"办公桌椅\", \"打印机耗材\", \"服务器设备\", \"空调设备\", \"投影仪\"]\n\ndef make_row(seq):\n    item = random.choice(items)\n    qty = random.randint(1, 60)\n    amount = round(qty * random.uniform(120, 9000), 2)\n    days = random.randint(0, 90)\n    return {\n        \"item_name\": item,\n        \"quantity\": qty,\n        \"total_amount\": amount,\n        \"approval_level\": random.choice([1, 2, 3]),\n        \"urgent\": random.random() < 0.1,\n        \"created_at\": date.today() - timedelta(days=days),\n    }\n\nseed_rows = [make_row(i) for i in range(100)]"
      },
      {
        "lane": 1,
        "path": "backend/routers/procurement.py",
        "lang": "python",
        "label": "采购单路由",
        "code": "# backend/routers/procurement.py\n\n@router.post(\"/procurement/orders\")\n@require_rbac_permission(\"procurement:create\")\nasync def create_order(\n    order: ProcurementOrderCreate,\n    current_user: User = Depends(get_current_user)\n):\n    \"\"\"创建采购单（带悲观锁防并发）\"\"\"\n    async with db.begin():\n        # 1. 检查库存（悲观锁）\n        item = await db.execute(\n            select(Item)\n            .where(Item.id == order.item_id)\n            .with_for_update()\n        )\n\n        if item.stock < order.quantity:\n            raise HTTPException(400, \"库存不足\")\n\n        # 2. 调用发票核验 Skill\n        invoice_result = await skill_invoker.call(\n            \"soe-vat-invoice-mcp-verifier\",\n            invoice_file=order.invoice_file\n        )\n        if not invoice_result.is_authentic:\n            raise HTTPException(400, \"发票核验失败\")\n\n        # 3. 创建订单并扣减库存\n        new_order = ProcurementOrder(**order.model_dump())\n        db.add(new_order)\n        item.stock -= order.quantity\n\n    return new_order"
      },
      {
        "lane": 1,
        "path": "backend/core/rbac.py",
        "lang": "python",
        "label": "RBAC 权限装饰器",
        "code": "# backend/core/rbac.py\nfrom functools import wraps\nfrom typing import Callable\n\n_ROLE_MATRIX = {\n    \"procurement:create\": {\"经办人\", \"处长\", \"管理员\"},\n    \"procurement:approve\": {\"处长\", \"管理员\"},\n    \"finance:export\": {\"财务\", \"管理员\"},\n    \"finance:sensitive\": set(),  # 敏感财务导出需单独授权\n}\n\ndef require_rbac_permission(action: str) -> Callable:\n    \"\"\"校验当前用户角色是否拥有该操作的权限。\"\"\"\n    def decorator(fn: Callable) -> Callable:\n        @wraps(fn)\n        async def wrapper(*args, **kwargs):\n            current_user = kwargs.get(\"current_user\")\n            allowed = _ROLE_MATRIX.get(action, set())\n            if not current_user or current_user.role not in allowed:\n                raise HTTPException(403, \"无权限执行此操作\")\n            return await fn(*args, **kwargs)\n        return wrapper\n    return decorator"
      },
      {
        "lane": 2,
        "path": "frontend/src/App.vue",
        "lang": "vue",
        "label": "前端根组件",
        "code": "<template>\n  <div class=\"app\">\n    <AppNav />\n    <main class=\"app-main\">\n      <ProcurementTable />\n      <OrderForm />\n    </main>\n  </div>\n</template>\n\n<script setup>\nimport AppNav from './components/AppNav.vue'\nimport ProcurementTable from './components/ProcurementTable.vue'\nimport OrderForm from './components/OrderForm.vue'\n</script>\n\n<style scoped>\n.app { display: flex; height: 100vh; }\n.app-main { flex: 1; padding: 24px; }\n</style>"
      },
      {
        "lane": 2,
        "path": "frontend/src/components/ProcurementTable.vue",
        "lang": "vue",
        "label": "采购单表格",
        "code": "<template>\n  <table class=\"procurement-table\">\n    <thead>\n      <tr><th>订单编号</th><th>采购物资</th><th class=\"amount\">金额</th><th>状态</th><th></th></tr>\n    </thead>\n    <tbody>\n      <tr v-for=\"order in orders\" :key=\"order.id\">\n        <td>{{ order.id }}</td>\n        <td>{{ order.item_name }}</td>\n        <td class=\"amount\">{{ money(order.total_amount) }}</td>\n        <td><StatusPill :status=\"order.status\" /></td>\n        <td><button @click=\"openApprove(order)\">审批</button></td>\n      </tr>\n    </tbody>\n  </table>\n</template>\n\n<script setup>\nconst props = defineProps({ orders: { type: Array, required: true } })\nconst emit = defineEmits(['approve'])\nconst money = n => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })\nconst openApprove = order => emit('approve', order)\n</script>"
      },
      {
        "lane": 3,
        "path": "skills/vat-invoice/SKILL.md",
        "lang": "markdown",
        "label": "发票核验技能",
        "code": "# 发票 OCR 核验技能包\n\n> 在处长初审前强制调用，未通过不得进入审批流。\n\n## 能力\n\n- 识别增值税发票关键字段（代码、号码、税额）\n- 调用 `soe-vat-invoice-mcp-verifier` 核验真伪\n- 返回 `is_authentic` 与验真摘要\n\n## 使用位置\n\n| 环节 | 是否强制 |\n| --- | --- |\n| 经办人提交 | 可选 |\n| 处长初审 | **强制拦截** |\n| 财务复核 | 可选复核 |\n\n## MCP 工具\n\n```yaml\nname: soe-vat-invoice-mcp-verifier\ninput: invoice_file\noutput: { is_authentic, summary }\n```"
      },
      {
        "lane": 3,
        "path": "deploy/docker-compose.yml",
        "lang": "yaml",
        "label": "容器编排",
        "code": "services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_DB: procurement\n      POSTGRES_USER: panshi\n      POSTGRES_PASSWORD: ${DB_PASSWORD}\n    volumes:\n      - db-data:/var/lib/postgresql/data\n\n  backend:\n    build: ./backend\n    depends_on:\n      - db\n    ports:\n      - \"8000:8000\"\n    environment:\n      DATABASE_URL: postgresql://panshi:${DB_PASSWORD}@db/procurement\n\n  frontend:\n    build: ./frontend\n    ports:\n      - \"5173:80\"\n    depends_on:\n      - backend\n\nvolumes:\n  db-data:"
      }
    ]
  },
  "stage4": {
    "frontend": {
      "steps": [
        {
          "desc": "登录系统"
        },
        {
          "desc": "遍历菜单"
        },
        {
          "desc": "填写表单"
        },
        {
          "desc": "调用 Skill 按钮"
        },
        {
          "desc": "审批流转"
        }
      ],
      "url": "http://procurement.local/approve",
      "checks": [
        { "el": "输入框 · 用户名", "pass": "已定位" },
        { "el": "主菜单 · 采购审批", "pass": "已遍历 5 项" },
        { "el": "表单 · 新建采购单", "pass": "字段已填写" },
        { "el": "按钮 · 发票核验", "pass": "Skill 已调用" },
        { "el": "审批 · 处长初审", "pass": "流程已流转" }
      ]
    },
    "browserSteps": [
      { "text": "打开登录页", "desc": "GET /login → 200，页面渲染正常" },
      { "text": "执行登录", "desc": "POST /api/auth → 302 至工作台" },
      { "text": "遍历采购菜单", "desc": "路由 /approve 可见，无未授权入口" },
      { "text": "提交采购表单", "desc": "POST /procurement/orders → 201" },
      { "text": "核验发票", "desc": "调用 Skill，返回 is_authentic=true" },
      { "text": "处长审批流转", "desc": "状态 pending → 初审通过" }
    ]
  },
  "stage5": {
    "skills": [
      {
        "name": "发票 OCR 核验技能包",
        "version": "v1.0.0",
        "fact": "发票 OCR 核验 · 1 个 MCP 工具"
      },
      {
        "name": "库存并发锁防超卖技能包",
        "version": "v1.0.0",
        "fact": "库存并发锁 · 1 个行级锁技能"
      }
    ]
  }
};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    moon:'<path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
    folder:'<path d="M3 7V5h6l2 2h10v13H3V7Z"/>', link:'<path d="m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/>',
    code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    check:'<path d="m5 12 4 4L19 6"/>', alert:'<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v.1"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'arrow-left':'<path d="M20 12H4m6 6-6-6 6-6"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'file': '<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8m-8 4h8"/>',
    chat:'<path d="M3 4h18v13H8l-5 4V4Z"/><path d="M7 8h10M7 12h7"/>',
    layers:'<path d="m12 3 10 5-10 5L2 8l10-5ZM2 13l10 5 10-5M2 18l10 5 10-5"/>',
    play:'<path d="m8 4 12 8-12 8V4Z"/>', pause:'<path d="M8 4v16M16 4v16"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5m11-2a8 8 0 0 0-14-5M4 14a8 8 0 0 0 14 5"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    external:'<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    // The two panel icons are the same shape seen from opposite sides: a
    // frame with one column filled. Which column is filled says which
    // panel the button controls.
    'panel-left':'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16" stroke-width="2.2"/>',
    'panel-right':'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16" stroke-width="2.2"/>',
    expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    desktop:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
    tablet:'<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M11 18h2"/>',
    phone:'<rect x="8" y="3" width="8" height="18" rx="2.5"/><path d="M11 18h2"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>',
    grip:'<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    doc:'<path d="M14 2H6v20h12V8l-4-6Zm0 0v6h6M9 13h6m-6 4h6"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    terminal:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m5 0h5"/>',
    filetree:'<path d="M3 6h6l2 2h10v11H3V6Z"/><path d="M8 11h8m-8 4h5"/>',
    split:'<path d="M3 5h18v14H3V5Z"/><path d="M12 5v14"/>',
    browser:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 8h18M7 6h.01M10 6h.01"/>',
    bug:'<path d="M8 9h8m-8 4h8M12 9v9m0-9V6m3 0H9l-1-3M9 6h6l-1 3"/>',
    gear:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.1-1.2L14.3 3h-4l-.3 2.7a7 7 0 0 0-2.1 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5.1 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.1 1.2l.3 2.7h4l.3-2.7a7 7 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"/>',
    'panel-left-g':'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16" stroke-width="2.2"/>',
    'panel-right-g':'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16" stroke-width="2.2"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
  const icons = (root = document) => $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  const btn = (text, action, primary = false, extra = '') => `<button type="button" class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" data-action="${action}" ${extra}>${text}</button>`;
  // A quiet button is for a way out of a dialog: present, but not competing
  // with the action that continues.
  const btnQuiet = (text, action, extra = '') => `<button type="button" class="btn btn-quiet" data-action="${action}" ${extra}>${text}</button>`;
  const titles = ['资产接入','原型契约','并发制造','质检自愈','交付上架'];
  const hints = ['识别技术债，整理业务规则与可用技能。','对齐需求和原型，确认三份机器可读契约。','按已批准的契约，观察四路制造进度。','复现攻防与页面巡航，跟踪修复闭环。','检查交付清单，导出当前项目演示记录。'];
  // One place holds the QA scenario. The three counters, the log lines and the
  // exported report are all read from it, so the numbers can never disagree.
  const QA_SCENARIO = {
    rounds: 50,
    issues: [
      { name:'库存超卖', detail:'并发扣减下库存计数为负', foundAt:1, fixedAt:2 },
      { name:'角色越权访问', detail:'普通角色读取到财务导出接口', foundAt:1, fixedAt:2 }
    ],
    steps: [
      { type:'info', text:'发起 50 轮并发库存扣减（模拟）' },
      { type:'warning', text:'捕获库存超卖与权限缺失场景' },
      { type:'info', text:'加入行锁与 RBAC 校验（模拟）' },
      { type:'success', text:'重跑用例，模拟修复完成' },
      { type:'success', text:'页面巡航五步骤演示完成' }
    ]
  };
  const STORAGE_KEY = 'panshi-workbench-v2';
  let saved = {};
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); if (value && typeof value === 'object') saved = value; } catch { /* Storage may be unavailable. */ }
  const sources = [
    {name:'老旧国企采购系统',kind:'源码项目',location:'legacy-procurement.zip',status:'示例 / 待扫描',icon:'folder'},
    {name:'发票核验 MCP',kind:'MCP 工具',location:'示例 MCP 配置',status:'示例 / 待转化',icon:'link'}
  ];
  const state = {
    currentStage: Math.min(5, Math.max(1, Number(saved.stage) || 1)),
    theme: ['light','dark'].includes(saved.theme) ? saved.theme : 'light',
    motion: saved.motion === 'reduced' ? 'reduced' : 'full',
    // The two side panels can be put away. The choice is kept between
    // visits, because a panel you had to reopen every morning is a panel
    // that gets in the way.
    leftPanel: saved.leftPanel !== 'hidden',
    rightPanel: saved.rightPanel !== 'hidden',
    // The split in the 需求与契约 stage: how wide the conversation side is,
    // kept between visits because a split the user sets is a split they want.
    reqSplit: Number(saved.reqSplit) || 46,
    // Which artifact file is open in the 四路产线 file explorer.
    openFile: null,
    // A sixth destination: the run log as a page of its own, rather than a
    // column competing with the work. The prototype preview is a seventh: a
    // full-page view of the prototype, for the person who wants to look.
    view: 'work',
    pushed: null,
    device: ['desktop','tablet','phone'].includes(saved.device) ? saved.device : 'desktop',
    sources, logs: [], logFilter:'all', logsPaused:false, pausedLogs:null,
    // How many records have arrived since the log was last looked at.
    logSeen:0,
    scan:0, scanDone:false, mcp:0, mcpDone:false, approved:false, built:false, qaDone:false,
    buildProgress: API.stage3.swarms.map(() => 0), qaStep:0, qaEvents:[],
    messages: API.stage2.cards[0].messages.map(m => ({...m})), chatBusy:false,
    requirements:[], contractTab:0, demo:false, seen:new Set(), scrolls:new Map(),
    selectedSource:0, logSeq:0
  };
  const jobs = new Map();
  const lifecycle = new AbortController();
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let animationContext, stageTimeline, resizeFrame;
  let dialogFocus = null, dialogKind = '';
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({stage:state.currentStage,theme:state.theme,motion:state.motion,leftPanel:state.leftPanel?'shown':'hidden',rightPanel:state.rightPanel?'shown':'hidden',device:state.device,reqSplit:state.reqSplit})); } catch { /* Continue in memory. */ }
  }
  function hasMotion() { return state.motion !== 'reduced' && !reducedQuery.matches; }

  /* ---- Motion ------------------------------------------------------------
     One vocabulary of moves, each with its own manner, so the interface never
     reads as a single fade repeated. Every helper is a no-op without GSAP and
     under reduced motion: the finished state is always the reduced state.
     The curves are the house tokens themselves, registered with GSAP so that
     a JS-driven move and a CSS-driven one decelerate identically. */
  const EASE = { out:'houseOut', expo:'houseExpo', inout:'houseInOut', exit:'houseExit' };
  // The four curves the stylesheet already uses, registered by name.
  function registerEases() {
    if (!window.gsap || gsap.registerEase.__house) return;
    try {
      gsap.registerEase('houseOut', p => 1 - Math.pow(1 - p, 3));
      gsap.registerEase('houseExpo', p => p === 1 ? 1 : 1 - Math.pow(2, -10 * p));
      gsap.registerEase('houseInOut', p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      gsap.registerEase('houseExit', p => p * p * p);
      // A damped spring, written out so the bundle needs no plugin: the
      // selection capsule and the segmented control settle on it.
      gsap.registerEase('houseSpring', p => {
        if (p === 0 || p === 1) return p;
        return 1 - Math.exp(-6.2 * p) * Math.cos(9.4 * p);
      });
      gsap.registerEase.__house = true;
    } catch { /* The built-in eases are a fine fallback. */ }
  }
  const motion = {
    // A heading arrives from behind its own baseline.
    maskIn(el, {delay=0, duration=.62}={}) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.from(el, {yPercent:108, autoAlpha:0, duration, delay, ease:EASE.expo, clearProps:'transform,opacity,visibility'});
    },
    // A block settles into place, rising from below.
    riseIn(el, {delay=0, duration=.44, distance=10}={}) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.from(el, {y:distance, autoAlpha:0, duration, delay, ease:EASE.out, clearProps:'transform,opacity,visibility'});
    },
    // A row arrives from the side it sits in.
    slideIn(el, {delay=0, duration=.4, from=-8}={}) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.from(el, {x:from, autoAlpha:0, duration, delay, ease:EASE.out, clearProps:'transform,opacity,visibility'});
    },
    // A band of figures is revealed by a clip that opens from its left edge.
    wipeIn(el, {delay=0, duration=.5}={}) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.from(el, {clipPath:'inset(0 100% 0 0)', autoAlpha:.4, duration, delay, ease:EASE.expo, clearProps:'clipPath,transform,opacity,visibility'});
    },
    // A line of the terminal slides up as it prints.
    logIn(el) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.from(el, {y:6, autoAlpha:0, duration:.22, ease:EASE.out, clearProps:'transform,opacity,visibility'});
    },
    // A figure counts to its value once.
    count(el, to, {duration=.6, delay=0}={}) {
      if (!el) return;
      const target = Number(to);
      if (!Number.isFinite(target)) return;
      if (el.textContent === String(target)) return;
      if (!hasMotion() || !window.gsap) { el.textContent = String(target); el.dataset.counted = String(target); return; }
      // Counting to the same value twice would restart the figure from zero, so
      // the target is remembered on the element.
      if (el.dataset.counted === String(target) && el.textContent === String(target)) return;
      const proxy = { v: 0 };
      el.textContent = '0';
      gsap.to(proxy, {v:target, duration, delay, ease:EASE.out, onUpdate:()=>{ el.textContent = String(Math.round(proxy.v)); }, onComplete:()=>{ el.textContent = String(target); el.dataset.counted = String(target); }});
    },
    // A figure arrives the way a mechanical counter does: the digits of the
    // number roll up into place, each column a beat behind the one to its
    // left. The real value stays in the text for screen readers and search.
    //
    // The columns are built once and reused. A value that changes length
    // rebuilds them; a value that only changes its digits moves them.
    rollFrame(el, text) {
      const shape = text.replace(/\d/g,'#');
      // The frame is rebuilt when the shape of the number changes, and also
      // when the element no longer holds one: under reduced motion the plain
      // number is written into the element, and the frame has to come back.
      if (el.dataset.rollShape !== shape || !el.querySelector('.roll__digits')) {
        const said = document.createElement('span');
        said.className = 'sr-only';
        said.textContent = text;
        const shown = document.createElement('span');
        shown.className = 'roll__digits';
        shown.setAttribute('aria-hidden','true');
        for (const ch of text) {
          if (!/\d/.test(ch)) { shown.append(document.createTextNode(ch)); continue; }
          const col = document.createElement('span');
          col.className = 'roll__col';
          const strip = document.createElement('span');
          strip.className = 'roll__strip';
          // Every digit is a span in the strip, so a column can rest on any of
          // them and the strip lays out as a real column of digits.
          for (let n = 0; n <= 10; n++) {
            const digitEl = document.createElement('span');
            digitEl.textContent = String(n % 10);
            strip.append(digitEl);
          }
          col.append(strip);
          shown.append(col);
        }
        el.replaceChildren(said, shown);
        el.dataset.rollShape = shape;
      } else {
        const said = $('.sr-only', el);
        if (said) said.textContent = text;
      }
      // Each column starts on 0 and stops on its own digit. The row height is
      // measured rather than assumed, so the strip lands exactly on the digit
      // whatever the font size is.
      const digits = text.replace(/\D/g,'');
      return $$('.roll__col', el).map((col,i)=>{
        const strip = $('.roll__strip', col);
        const digit = Number(digits[i] ?? 0);
        return { strip, digit, row: strip.firstElementChild?.offsetHeight || 0 };
      });
    },
    // The roll as a standalone move, for a figure that changes on its own.
    rollTo(el, to, {duration=.9, delay=0}={}) {
      if (!el) return;
      const target = Number(to);
      if (!Number.isFinite(target)) return;
      const text = String(target);
      if (el.dataset.rolled === text) return;
      el.dataset.rolled = text;
      if (!hasMotion() || !window.gsap) { el.textContent = text; return; }
      this.rollFrame(el, text).forEach((col,i)=>{
        if (!col.row) return;
        gsap.set(col.strip, {y:0});
        gsap.to(col.strip, {y:-col.digit*col.row, duration, delay: delay + i*.06, ease:EASE.expo, overwrite:true});
      });
    },
    // The roll inside a timeline, so a stage switch can stop it: the digits
    // are placed on the timeline rather than on the global clock.
    rollOn(timeline, el, text, position=0, {duration=.9, stagger=.06}={}) {
      if (!timeline || !el) return;
      const frames = this.rollFrame(el, text);
      frames.forEach((col,i)=>{
        if (!col.row) return;
        timeline.set(col.strip, {y:0}, position);
        timeline.to(col.strip, {y:-col.digit*col.row, duration, ease:EASE.expo, overwrite:true}, position + i*stagger);
      });
    },
    // A bar reaches its end and settles.
    fillTo(el, ratio, {duration=.7, delay=0}={}) {
      if (!el) return;
      if (!hasMotion() || !window.gsap) { el.style.transform = `scaleX(${ratio})`; return; }
      gsap.to(el, {scaleX:ratio, duration, delay, ease:EASE.out, overwrite:true});
      // A bar that lands on full acknowledges it once.
      if (ratio >= 1) gsap.fromTo(el, {filter:'brightness(1)'}, {filter:'brightness(1.35)', duration:.18, delay:delay+duration, yoyo:true, repeat:1, ease:'none', clearProps:'filter'});
    },
    // A control gives under the hand.
    press(el) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.fromTo(el, {scale:.97}, {scale:1, duration:.24, ease:EASE.out, clearProps:'transform'});
    },
    // A panel rises from the bottom edge, the way a sheet does on a phone.
    sheetIn(el) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.from(el, {yPercent:6, autoAlpha:0, duration:.34, ease:EASE.out, clearProps:'transform,opacity,visibility'});
    },
    // A marker travels to a new position.
    travel(el, vars) {
      if (!el) return;
      if (!hasMotion() || !window.gsap) { vars.onComplete?.(); return; }
      gsap.to(el, {...vars, duration:vars.duration ?? .55, ease:vars.ease ?? EASE.inout, overwrite:true});
    },
    // A selection capsule slides to the item that was chosen and settles on
    // a damped spring, the way a segmented control does. The capsule is a
    // separate element, so the label underneath never reflows.
    capsule(el, {x=0, width=null, duration=.55, opacity=1}={}) {
      if (!el) return;
      if (!hasMotion() || !window.gsap) {
        el.style.transform = `translateX(${x}px)`;
        if (width) el.style.width = `${width}px`;
        el.style.opacity = String(opacity);
        return;
      }
      gsap.to(el, {
        x,
        ...(width ? {width} : {}),
        autoAlpha:opacity,
        duration,
        ease:'houseSpring',
        overwrite:true
      });
    },
    // A value changes colour so a change is readable, not just numeric.
    flash(el, tone='accent') {
      if (!el || !hasMotion() || !window.gsap) return;
      const colour = tone==='positive' ? 'var(--success)' : tone==='negative' ? 'var(--danger)' : 'var(--accent)';
      gsap.fromTo(el, {color:colour}, {color:'', duration:.7, delay:.1, ease:'none', clearProps:'color'});
    },
    // A panel opens from the edge it was triggered from.
    popIn(el) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.from(el, {y:8, scale:.99, autoAlpha:0, duration:.24, ease:EASE.out, clearProps:'transform,opacity,visibility'});
    },
    // A step in a sequence becomes the current one.
    focusStep(el) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.fromTo(el, {scale:.94}, {scale:1, duration:.3, ease:EASE.out, clearProps:'transform'});
    },
    // A row of content discloses itself in place: each item rises a fraction
    // of its own height, one after another. Short and quiet, for lists that
    // are known to the user and only need to be re-introduced.
    disclose(el, {delay=0, stagger=.06, duration=.3, distance=6}={}) {
      if (!el) return;
      const items = $(el).children.length ? $$(el) : null;
      if (!items || !items.length) return;
      if (!hasMotion() || !window.gsap) return;
      gsap.from(items, {y:distance, autoAlpha:0, duration, stagger, delay, ease:EASE.out, clearProps:'transform,opacity,visibility', overwrite:'auto'});
    },
    // A tiny pop with a spring settle, for a mark that appears and matters.
    pop(el, {scale=1.15, duration=.5}={}) {
      if (!el || !hasMotion() || !window.gsap) return;
      gsap.fromTo(el, {scale}, {scale:1, duration, ease:'houseSpring', clearProps:'transform', overwrite:'auto'});
    },
    // Everything above is optional: without GSAP the UI simply arrives.
    kill() { if (window.gsap) gsap.killTweensOf('*'); }
  };

  function setupMotion() {
    animationContext?.revert();
    if (!window.gsap) return;
    registerEases();
    if (!hasMotion()) {
      // Reduced motion means the finished page, not a snapshot of an
      // interrupted animation: every bar sits at its own value, the cursor is
      // hidden and the indicator is settled where it belongs.
      gsap.killTweensOf('.progress-fill,.test-cursor,.toast,.stage-view,.stage-hero,.stage-title,.stage-subtitle,.card,.overview-strip');
      $$('.progress-fill').forEach(el => { el.style.transform=`scaleX(${Number(el.dataset.value||0)/100})`; });
      const cursor = $('#testCursor');
      if (cursor) { cursor.style.opacity='0'; cursor.style.transform='translate(0,0)'; }
      updateIndicator();
      return;
    }
    animationContext = gsap.matchMedia();
    animationContext.add('(prefers-reduced-motion: no-preference)', () => {
      if (hasMotion()) animateStage({first:true});
    });
  }
  // A stage change is composed, not a single fade: the heading masks in, the
  // blocks rise in reading order, and the bars sweep to their current value.
  // The full sequence runs only the first time a stage is opened — after that
  // the screen is already known and a repeated entrance would be theatre.
  //
  // Every tween is added to the timeline itself. A tween created inside a
  // timeline callback lives outside the timeline, so progress(1).kill() could
  // not stop it and a fast stage switch left two stages fighting over the
  // same elements.
  function animateStage({first=false, from=null, direction=1}={}) {
    const view = $(`.stage-view[data-view="${state.currentStage}"]`);
    if (!view) return;
    stageTimeline?.progress(1).kill();
    if (!hasMotion()) return;
    if (!window.gsap) { view.classList.remove('motion-fallback'); void view.offsetWidth; view.classList.add('motion-fallback'); return; }
    const title = $('.stage-title', view), subtitle = $('.stage-subtitle', view);
    const hero = $('.stage-hero', view);
    const blocks = $$('.overview-strip,.cards-grid > .card,.req-split,.explorer-panel,.qa-layout,.swarm-grid > .card,.deliverable-grid > .card,.manifest-card,.delivery-summary', view);
    const fills = $$('.progress-fill', view);
    stageTimeline = gsap.timeline({defaults:{ease:EASE.out}});
    // The screen that was open and the one that opens are two states of the
    // same stack, so they move the way a pushed screen moves: the new one
    // comes in from the direction of travel and the old one goes out the
    // other way. This is the interface saying which way the user went, not
    // a performance. With nothing to push against — the first paint — there
    // is no travel, only the content arriving.
    const travel = direction >= 0 ? 1 : -1;
    const pushing = !!(from && from.isConnected && from !== view);
    if (pushing) {
      stageTimeline.fromTo(from,{xPercent:0},{xPercent:-7*travel,duration:.34,ease:EASE.out,clearProps:'transform,opacity,visibility'},0);
      stageTimeline.to(from,{autoAlpha:0,duration:.16,ease:EASE.out},0);
      // The screen that was open is put away once it has travelled off. It
      // is left in place until then, so the move reads as one screen giving
      // way to another rather than a flicker.
      stageTimeline.call(()=>{
        from.hidden = true;
        from.classList.remove('is-leaving');
        from.style.removeProperty('transform');
        from.style.removeProperty('opacity');
        from.style.removeProperty('visibility');
      },null,'>');
    }
    // On a first visit the screen arrives from off the edge; afterwards it
    // settles in from a short distance, because the user knows this screen
    // and only needs to be told that it changed.
    if (pushing) {
      const enter = first ? 12 : 5;
      stageTimeline.fromTo(view,{xPercent:enter*travel,autoAlpha:first?.55:.7},{xPercent:0,autoAlpha:1,duration:first?.42:.34,ease:EASE.out,clearProps:'transform,opacity,visibility'},0);
    } else if (!first) {
      stageTimeline.fromTo(view,{autoAlpha:.6},{autoAlpha:1,duration:.22,clearProps:'opacity,visibility'},0);
    }
    if (!first) {
      fills.forEach((el,i)=>{
        const ratio = Number(el.dataset.value || 0)/100;
        stageTimeline.to(el,{scaleX:ratio,duration:.5,ease:EASE.out,overwrite:true},i*.03);
      });
      return;
    }
    if (title) stageTimeline.from(title,{yPercent:108,autoAlpha:0,duration:.6,ease:EASE.expo,clearProps:'transform,opacity,visibility'},0);
    if (subtitle) stageTimeline.from(subtitle,{y:10,autoAlpha:0,duration:.4,delay:.06,clearProps:'transform,opacity,visibility'},.06);
    if (hero && title) stageTimeline.from(hero,{y:10,autoAlpha:0,duration:.4,delay:.04,clearProps:'transform,opacity,visibility'},0);
    // The delivery stage celebrates a completed run the first time it is seen.
    if (state.currentStage === 5 && updateDelivery._ready && !updateDelivery._celebrated) {
      updateDelivery._celebrated = true;
      const badge = $('#deliveryBadge');
      if (badge) motion.pop(badge, {scale:1.4, duration:.65});
      const summary = $('.delivery-summary');
      if (summary) {
        stageTimeline.fromTo(summary,{backgroundColor:'var(--success-bg)'},{backgroundColor:'',duration:1.2,ease:'none',clearProps:'backgroundColor'},.25);
      }
    }
    blocks.forEach((block,i)=>{
      // The strip wipes in along its own edge; the cards rise. Two manners, so
      // the stage does not read as one repeated fade.
      if (block.classList.contains('overview-strip')) {
        stageTimeline.from(block,{clipPath:'inset(0 100% 0 0)',autoAlpha:.4,duration:.5,delay:.1+i*.05,ease:EASE.expo,clearProps:'clipPath,transform,opacity,visibility'},.1+i*.05);
      } else {
        stageTimeline.from(block,{y:10,autoAlpha:0,duration:.42,delay:.1+i*.05,clearProps:'transform,opacity,visibility'},.1+i*.05);
      }
    });
    // The rows inside a block arrive only after the blocks have landed, so the
    // eye reads two clear beats — the frame, then what the frame holds. Each
    // row rises a hair and the stagger is short: this is disclosure, not a
    // parade.
    const rowsStart = .12 + blocks.length*.05;
    const rows = $$('.data-row,.task-step,.requirement-row,.swarm-line,.event-row,.manifest-row,.skill-row,.chat-message,.issue-row,.qa-check,.source-item,.agent-item,.contract-item,.pipeline-step,.tree-item', view);
    rows.forEach((row,i)=>{
      stageTimeline.from(row,{y:5,autoAlpha:0,duration:.26,delay:.02+i*.012,ease:EASE.out,clearProps:'transform,opacity,visibility'},rowsStart+i*.012);
    });
    // The figures roll up rather than simply appearing: the digits of each
    // number turn like a counter wheel, one column a beat behind the next.
    // The unit beside the number stays put, because only the number itself
    // is rebuilt. On a phone the roll is skipped — the number simply lands at
    // its value, so the DOM carries one number rather than a strip of digits
    // that a reader would trip over.
    const rollOk = matchMedia('(min-width: 620px)').matches;
    $$('.overview-stat .stat-number', view).forEach((el,i)=>{
      const value = Number(el.dataset.count);
      if (!Number.isFinite(value) || value <= 0) return;
      if (!rollOk) { el.textContent = String(value); el.dataset.counted = String(value); return; }
      motion.rollOn(stageTimeline, el, String(value), .16+i*.05, {duration:.9, stagger:.06});
    });
    fills.forEach((el,i)=>{
      const ratio = Number(el.dataset.value || 0)/100;
      stageTimeline.to(el,{scaleX:ratio,duration:.8,delay:.18+i*.04,ease:EASE.out,overwrite:true},.18+i*.04);
    });
  }
  // The indicator travels on transform, not on left/width: the one element the
  // eye follows across five stages moves instead of reflowing the nav bar.
  // The capsule behind the active label does the job a segmented control
  // does, and it settles on a damped spring.
  function updateIndicator() {
    const active = $('.stage-pill.active'), indicator = $('.nav-indicator');
    const capsule = $('.nav-selection');
    if (!active || !indicator) return;
    const nav = indicator.parentElement;
    const originLeft = (nav?.getBoundingClientRect().left || 0);
    const rect = active.getBoundingClientRect();
    const left = rect.left - originLeft;
    const base = indicator.offsetWidth || 1;
    if (hasMotion() && window.gsap) {
      // The hairline is hidden while the log page is open — there is no stage
      // to mark — so it comes back with the stage it belongs to.
      gsap.to(indicator, {x:left, scaleX:active.offsetWidth/base, autoAlpha:1, duration:.42, ease:EASE.inout, overwrite:true, transformOrigin:'left center'});
      if (capsule) {
        // The capsule takes the size of the label it marks. Its height is set
        // once, because every label in the bar is the same height; its width
        // and position travel on the spring.
        if (capsule.offsetHeight !== active.offsetHeight) {
          gsap.set(capsule, {height:active.offsetHeight, top:active.offsetTop});
        }
        // The first placement is not a move: the capsule is already where it
        // belongs when the page opens, so it simply appears there.
        if (capsule.dataset.placed) {
          motion.capsule(capsule, {x:left, width:active.offsetWidth, duration:.5});
        } else {
          capsule.dataset.placed = '1';
          gsap.set(capsule, {x:left, width:active.offsetWidth, autoAlpha:1});
        }
      }
      return;
    }
    indicator.style.transform = `translateX(${left}px) scaleX(${active.offsetWidth/base})`;
    indicator.style.opacity = '1';
    if (capsule) {
      capsule.style.height = `${active.offsetHeight}px`;
      capsule.style.top = `${active.offsetTop}px`;
      capsule.style.transform = `translateX(${left}px)`;
      capsule.style.width = `${active.offsetWidth}px`;
      capsule.style.opacity = '1';
    }
  }
  // The hover mark follows the pointer over the stage names, the way a
  // segmented control lights the item under the cursor. It is a separate
  // element so the label under it never moves.
  function updateNavHover(pill) {
    const hover = $('.nav-hover');
    if (!hover) return;
    if (!pill || !hasMotion() || !window.gsap) { if (hover) hover.style.opacity = '0'; return; }
    const nav = hover.parentElement;
    const originLeft = nav.getBoundingClientRect().left;
    const rect = pill.getBoundingClientRect();
    gsap.to(hover, {x:rect.left - originLeft, width:rect.width, autoAlpha:1, duration:.28, ease:EASE.out, overwrite:true});
  }
  // Each stage has its own completion rule, so the rail reports real progress rather than "visited".
  const stageStatus = stage => {
    if (stage === 1) return state.scanDone ? 'done' : state.sources.length ? 'ready' : 'idle';
    if (stage === 2) return state.approved ? 'done' : state.requirements.length ? 'ready' : 'idle';
    if (stage === 3) return state.built ? 'done' : state.approved ? 'ready' : 'idle';
    if (stage === 4) return state.qaDone ? 'done' : state.built ? 'ready' : 'idle';
    return state.qaDone ? 'done' : state.built ? 'ready' : 'idle';
  };
  const statusLabel = { done: '已完成', ready: '可进行', idle: '未开始' };
  function renderRail() {
    const stage = state.currentStage;
    const railStage = $('#railStage'), railNum = $('#railStageNum'), railHint = $('#railHint'), track = $('#pipelineTrack');
    if (!railStage || !track) return;
    railStage.textContent = titles[stage-1];
    railNum.textContent = `工段 ${stage} / 5`;
    railHint.textContent = hints[stage-1];
    const done = titles.filter((_,i)=>stageStatus(i+1)==='done').length;
    track.innerHTML = titles.map((title,i)=>{
      const n = i+1, status = stageStatus(n), active = n===stage;
      return `<button type="button" class="pipeline-step ${status}${active?' active':''}" data-stage="${n}" aria-current="${active?'step':'false'}" title="${title} · ${statusLabel[status]}"><span class="pipeline-mark">${status==='done'?icon('check'):n}</span><span class="pipeline-name">${title}</span></button>`;
    }).join('');
    const summary = $('#railProgress');
    if (summary) summary.textContent = done === 5 ? '五个工段全部完成' : `已完成 ${done} / 5 个工段`;
  }
  // ---- Panels and pages ---------------------------------------------------
  // The two side panels are put away rather than removed. The grid track
  // animates in the stylesheet, so the work area grows into the space the
  // panel gives back instead of jumping. The panel itself fades as it goes.
  function applyPanels() {
    const root = document.documentElement;
    root.classList.toggle('left-collapsed', !state.leftPanel);
    root.classList.toggle('right-collapsed', !state.rightPanel);
    // The buttons say what they will do, not what is true now, because a
    // button labelled "hide" that has already hidden its panel is a label
    // for a state, not an action.
    const toggleLeft = $('[data-action="toggle-left"]');
    const toggleRight = $('[data-action="toggle-right"]');
    if (toggleLeft) {
      toggleLeft.setAttribute('aria-pressed', String(!state.leftPanel));
      toggleLeft.setAttribute('aria-label', state.leftPanel ? '隐藏左侧栏' : '显示左侧栏');
      toggleLeft.title = state.leftPanel ? '隐藏左侧栏' : '显示左侧栏';
    }
    if (toggleRight) {
      toggleRight.setAttribute('aria-pressed', String(!state.rightPanel));
      toggleRight.setAttribute('aria-label', state.rightPanel ? '隐藏右侧栏' : '显示右侧栏');
      toggleRight.title = state.rightPanel ? '隐藏右侧栏' : '显示右侧栏';
    }
  }
  function togglePanel(side) {
    if (side === 'left') state.leftPanel = !state.leftPanel;
    else state.rightPanel = !state.rightPanel;
    applyPanels();
    persist();
    addLog('info', side === 'left'
      ? (state.leftPanel ? '显示左侧栏' : '收起左侧栏')
      : (state.rightPanel ? '显示右侧栏' : '收起右侧栏'));
  }
  // The run log is a page. It arrives the way a page arrives — pushed in from
  // the right — and it keeps the work behind it, so returning is a push back
  // rather than a rebuild.
  function openLogView() {
    if (state.view === 'logs') return;
    // The log page and the pushed prototype view are both whole-pane pages.
    // One at a time: opening the log closes the pushed view first.
    if (state.pushed) hidePushedView({silent:true});
    state.view = 'logs';
    const logView = $('#logView'), stageViews = $('#stageViews');
    if (!logView) return;
    logView.hidden = false;
    if (stageViews) stageViews.hidden = true;
    document.body.classList.add('show-log-view');
    renderLogs(true);
    // Everything that has happened so far has now been seen, so the badge
    // starts again from nothing.
    state.logSeen = state.logs.length;
    syncLogCount();
    if (hasMotion() && window.gsap) {
      gsap.fromTo(logView,{xPercent:4,autoAlpha:.4},{xPercent:0,autoAlpha:1,duration:.34,ease:EASE.out,clearProps:'transform,opacity,visibility'});
    }
    const announcer = $('#announce');
    if (announcer) announcer.textContent = '运行记录';
    // The log page has no stage of its own, so the stage strip has nothing to
    // mark. It is dimmed rather than left showing a stage that is not there.
    $$('.stage-pill').forEach(el => el.classList.remove('active'));
    $('.nav-stages')?.classList.add('is-dimmed');
    // The hairline under the strip marks the current stage, so it goes too.
    const indicator = $('.nav-indicator');
    if (indicator && window.gsap && hasMotion()) gsap.to(indicator,{autoAlpha:0,duration:.2,ease:EASE.out,overwrite:true});
    else if (indicator) indicator.style.opacity = '0';
  }
  function leaveLogView({silent = false} = {}) {
    if (state.view !== 'logs') return;
    state.view = 'work';
    const logView = $('#logView'), stageViews = $('#stageViews');
    if (logView) logView.hidden = true;
    if (stageViews) stageViews.hidden = false;
    document.body.classList.remove('show-log-view');
    $('.nav-stages')?.classList.remove('is-dimmed');
    // What arrived while the log was open is still worth counting.
    state.logSeen = state.logs.length;
    syncLogCount();
    // The strip has to mark a stage again, so the active pill is put back —
    // unless the work behind the log is itself hidden behind the pushed view.
    if (state.pushed) return;
    $$('.stage-pill').forEach(el => {
      const active = Number(el.dataset.stage) === state.currentStage;
      el.classList.toggle('active', active);
      if (active) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
    });
    updateIndicator();
    if (!silent) { const announcer = $('#announce'); if (announcer) announcer.textContent = `工段 ${state.currentStage} / 5 · ${titles[state.currentStage-1]}`; }
  }  function switchStage(stage, {automatic = false, initial = false, focus = false} = {}) {
    stage = Number(stage);
    if (!Number.isInteger(stage) || stage < 1 || stage > 5) return;
    if (state.demo && !automatic) stopDemo();
    // Choosing a stage from anywhere returns to the work. The run log is a
    // page you visit, not a mode you get stuck in; the pushed prototype view
    // is the same — going anywhere returns to the work.
    if (state.pushed) hidePushedView({silent:true});
    if (state.view !== 'work') { leaveLogView({silent:true}); }
    const main = $('#workspace');
    const first = !state.seen.has(stage);
    // The screen that was open leaves in the direction the user travelled, and
    // the one that opens arrives from the other side. The outgoing screen is
    // kept alive for the length of the move so the two can be seen travelling
    // together.
    const outgoing = $(`.stage-view[data-view="${state.currentStage}"]`);
    const direction = stage > state.currentStage ? 1 : -1;
    state.scrolls.set(state.currentStage, main.scrollTop);
    state.currentStage = stage;
    state.seen.add(stage);
    $$('.stage-pill').forEach(el => {
      const active = Number(el.dataset.stage) === stage;
      el.classList.toggle('active',active);
      if (active) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
    });
    $$('.stage-view').forEach(el => { if (el !== outgoing) el.hidden = Number(el.dataset.view) !== stage; });
    // While the two screens travel, the outgoing one is lifted out of the flow
    // so it slides over the incoming one instead of pushing it down the page.
    // It is already on screen, so it only needs to be taken out of the flow.
    if (outgoing && outgoing !== undefined && !initial) outgoing.classList.add('is-leaving');
    main.scrollTop = state.scrolls.get(stage) || 0;
    // The compact title in the context row names the stage that is open.
    const contextStage = $('#contextStage');
    if (contextStage) contextStage.textContent = titles[stage-1];
    renderRail();
    updateIndicator();
    // The device switch only exists on stage 2, so its capsule is placed when
    // that stage is on screen and left alone otherwise.
    requestAnimationFrame(updateDeviceIndicator);
    if (!initial) { addLog('info',`打开工段 ${stage} / ${titles[stage-1]}`); animateStage({first,from:outgoing,direction}); }
    // The visible heading change is announced once, so a screen reader user
    // knows which stage the rest of the page now belongs to.
    const announcer = $('#announce');
    if (announcer) announcer.textContent = `工段 ${stage} / 5 · ${titles[stage-1]}`;
    if (focus && !automatic) main.focus({preventScroll:true});
    persist();
  }
  function header(n,title,subtitle,actions='') {
    return `<div class="stage-hero"><div><div class="stage-index">工段 ${n} / 5</div><h1 class="stage-title">${title}</h1><p class="stage-subtitle">${subtitle}</p></div>${actions ? `<div class="hero-actions">${actions}</div>` : ''}</div>`;
  }
  function card(title,body,action='',className='') {
    return `<section class="card ${className}"><div class="card-header"><h2 class="card-title">${title}</h2>${action}</div><div class="card-body">${body}</div></section>`;
  }
  function footer(text,next,label) { return `<div class="stage-footer"><span>${text}</span>${next?`<button class="btn btn-secondary" data-stage="${next}">${label || titles[next-1]} ${icon('arrow')}</button>`:''}</div>`; }
  function progress(value,label,id='') { return `<div class="progress-bar" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" ${id?`id="${id}"`:''}><div class="progress-fill" data-value="${value}" style="transform:scaleX(${value/100})"></div></div>`; }
  function setProgress(id,value) {
    const el = document.getElementById(id); if (!el) return;
    el.setAttribute('aria-valuenow',value);
    const fill = $('.progress-fill',el);
    if (!fill) return;
    fill.dataset.value = value;
    motion.fillTo(fill, value/100, {duration:.55});
  }
  // Every requirement is written into all three contracts, so the trace below
  // can be read off the files themselves instead of guessed.
  const requirementNotes = prefix => state.requirements.length
    ? `\n${prefix} 需求补充：\n${state.requirements.map((x,i)=>`${prefix}   ${i+1}. ${x.replace(/[\r\n]/g,' ')}`).join('\n')}\n`
    : '';
  const contractFiles = () => [
    {name:'schema.sql',desc:'数据库契约',text:`-- 磐石智造 · 采购模块演示契约（非完整生产数据库）\nCREATE TABLE procurement_orders (\n  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  item_name VARCHAR(160) NOT NULL,\n  quantity INTEGER NOT NULL CHECK (quantity > 0),\n  total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),\n  approval_level INTEGER NOT NULL DEFAULT 1 CHECK (approval_level BETWEEN 1 AND 3),\n  invoice_verified BOOLEAN NOT NULL DEFAULT FALSE,\n  urgent BOOLEAN NOT NULL DEFAULT FALSE,\n  status VARCHAR(24) NOT NULL DEFAULT 'pending'\n);\n-- 审批前必须完成发票核验；保留三级审批${requirementNotes('--')}`},
    {name:'openapi.yaml',desc:'API 契约',text:`openapi: 3.0.3\ninfo:\n  title: 磐石采购 API 演示契约\n  version: 1.0.0\npaths:\n  /procurement/orders:\n    post:\n      summary: 创建采购单\n      security:\n        - bearerAuth: []\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              type: object\n              required: [item_name, quantity, total_amount]\n              properties:\n                item_name: { type: string }\n                quantity: { type: integer, minimum: 1 }\n                total_amount: { type: number, minimum: 0 }\n                urgent: { type: boolean }\n      responses:\n        '201': { description: 创建成功 }\n        '403': { description: 无创建权限 }\ncomponents:\n  securitySchemes:\n    bearerAuth:\n      type: http\n      scheme: bearer${requirementNotes('#')}`},
    {name:'component_tree.json',desc:'组件契约',text:JSON.stringify({project:'国企采购管理系统',mode:'frontend-demo',pages:[{name:'采购审批',components:['ProcurementTable','OrderForm','InvoiceVerifier','ApprovalFlow'],approvalLevels:3,roles:['经办人','处长','财务','管理员']}],notes:state.requirements},null,2)}
  ];
  // Each contract reports what it actually contains, so the approval dialog
  // shows three different facts instead of three identical green labels. Every
  // number is counted from that file's own text.
  function contractSummary() {
    const files = contractFiles();
    const countReq = text => (text.match(/^\s*(?:--|#)\s+\d+\.\s/gm) || []).length;
    const schema = (files[0].text.match(/CREATE TABLE/g) || []).length;
    const paths = (files[1].text.match(/^  \/[\w/-]+:/gm) || []).length;
    const tree = JSON.parse(files[2].text);
    const components = (tree.pages[0]?.components || []).length;
    return [
      { name:files[0].name, desc:files[0].desc, fact:`${schema} 张表 · ${countReq(files[0].text)} 条补充需求` },
      { name:files[1].name, desc:files[1].desc, fact:`${paths} 个接口路径 · ${countReq(files[1].text)} 条补充需求` },
      { name:files[2].name, desc:files[2].desc, fact:`${components} 个组件 · ${(tree.notes||[]).length} 条补充需求` }
    ];
  }
  // A requirement is only useful if you can see where it landed. The target is
  // read off the contract texts, so the label cannot drift from the file.
  function requirementTargets(text) {
    const files = contractFiles();
    return files.filter(f => f.text.includes(text.replace(/[\r\n]/g,' '))).map(f=>f.name);
  }
  function requirementList() {
    if (!state.requirements.length) return '<li class="empty-state">还没有补充需求。对话中提出的要求会出现在这里，并写入契约备注。</li>';
    return state.requirements.map((text,i)=>{
      const targets = requirementTargets(text);
      const target = targets.length ? targets.join(' · ') : '尚未写入';
      const note = /角色|权限|导出|财务/.test(text) ? '权限边界' : /审批|紧急|流程/.test(text) ? '流程规则' : '业务字段';
      return `<li class="requirement-row" data-req="${i}"><span class="requirement-index">${i+1}</span><span class="requirement-text">${escape(text)}</span><span class="requirement-target">${escape(target)}</span><span class="requirement-kind">${note}</span></li>`;
    }).join('');
  }
  function syncRequirementTrace() {
    const list = $('#requirementList');
    if (!list) return;
    const count = $('#requirementTraceCount');
    if (count) count.textContent = `${state.requirements.length} 条`;
    list.innerHTML = requirementList();
    const last = list.lastElementChild;
    if (last && !last.classList.contains('empty-state')) {
      motion.slideIn(last,{from:-6,duration:.3});
      const mark = $('.requirement-index', last);
      if (mark) motion.pop(mark, {scale:1.5, duration:.5});
    }
  }
  function stage1() {
    const scan = API.stage1.cards[0];
    const data = scan.data.map(item => `<div class="data-row"><span class="data-label">${escape(item.label)}</span><span class="${item.badge?`badge badge-${item.badge}`:'data-value'}">${escape(item.value)}</span></div>`).join('');
    const before = API.stage1.cards[1].before;
    // Keep the branch from the legacy snippet: do not present a non-equivalent rewrite.
    const after = '// 保留原始分支语义的重命名示例\nfunction computeLegacyValue(value, rate) {\n  const product = value * rate;\n  return product > 1000\n    ? Math.trunc(product / 12)\n    : product;\n}\n// 类型溢出与业务等价性仍需后端验证';
    // Which diagnostic step is next reads the same way in the strip and in
    // the running state, so the two can never disagree.
    const stepDone = key => key==='sources' ? state.sources.length>0 : key==='scan' ? state.scanDone : key==='mcp' ? state.mcpDone : state.scanDone;
    const firstOpen = API.stage1.steps.find(s=>!stepDone(s.key))?.key || null;
    return header(1,'存量资产诊断','识别技术债、提取业务规则，把旧系统带到可评估的起点。',btn(`${icon('refresh')} 扫描演示`,'scan',true,'id="scanBtn"')) +
      `<div class="diag-steps" role="list" aria-label="诊断流程">${API.stage1.steps.map((s,i)=>{
        const complete = stepDone(s.key);
        const current = !complete && s.key === firstOpen;
        const goText = complete ? '已完成' : current ? '运行' : '待办';
        return `<button class="diag-step ${complete?'done':current?'current':''}" data-diag="${s.key}" ${s.key==='scan'?'data-action="scan"':s.key==='mcp'?'data-action="mcp"':''} role="listitem">
          <span class="diag-mark">${complete?icon('check'):i+1}</span>
          <span class="diag-body"><strong>${s.name}</strong><span>${s.hint}</span></span>
          ${s.key==='scan'||s.key==='mcp'?`<span class="diag-go">${goText}</span>`:''}
        </button>`;
      }).join('')}</div>` +
      `<div class="overview-strip">${API.stage1.stats.map((stat,i)=>{
        // Figures that only exist after the scan runs print as a grey dash, not
        // as a number: an unrun scan has not found anything yet.
        const pending = !stat.live && !state.scanDone;
        const value = stat.live ? state.sources.length : stat.value;
        const text = pending ? '—' : value;
        const tag = i===0?'button':'div';
        return `<${tag} class="overview-stat ${i===0?'statistic-action':''} ${pending?'is-pending':''}" ${i===0?'data-action="sources" aria-label="查看已接入资产"':''}><span>${stat.label}</span><strong ${stat.risk&&!pending?'class="risk"':''} ${i===0?'id="sourceTotal"':''}><span class="stat-number" data-count="${pending?'':value}">${text}</span><small>${pending?'':stat.unit}</small></strong></${tag}>`;
      }).join('')}</div>` +
      `<div class="cards-grid">${card(`${icon('search')} 项目全栈扫描`,`<p class="card-note">legacy-procurement.zip <span class="muted">· 示例诊断快照</span></p><p class="card-note provenance">来源：内置示例资产，非本次接入的真实仓库。</p><div class="data-list">${data}</div><div style="margin-top:18px"><div class="progress-label"><span id="scanLabel">等待开始扫描演示</span><strong id="scanPercent">0%</strong></div>${progress(0,'扫描演示进度','scanProgress')}</div>`,`<span class="badge badge-neutral" id="scanBadge">待扫描</span>`)}
      ${card(`${icon('link')} MCP 工具转化`,`<p class="card-note">将发票核验工具整理为标准技能包。以下流程为本地模拟，不会发布到外部平台。</p><ol class="step-list" id="mcpSteps">${mcpSteps()}</ol>`,btn('运行演示','mcp',false,'id="mcpBtn"'))}
      ${card(`${icon('code')} 遗产代码 · 语义还原`,`<p class="card-note">保留分支行为，先读懂原逻辑，再重构。此处为代码示例，不代表已完成等价验证。</p><div class="code-compare"><div><div class="code-label"><span>原始反编译代码</span><span>C / legacy</span></div><pre class="code-block"><code>${escape(before)}</code></pre></div><div><div class="code-label"><span>可读代码示例</span><button class="text-button" data-action="copy-refactor">${icon('copy')} 复制</button></div><pre class="code-block" id="refactorCode"><code>${escape(after)}</code></pre></div></div>`,'','full')}</div>` + footer('诊断数据为内置样例；接入信息仅保存在本次会话。',2,'前往原型契约');
  }
  // The diagnostic step strip re-reads the demo state on every change, so a
  // finished scan lights the next step without a full re-render. Only the
  // earliest unfinished step is "current": the flow is one thing at a time.
  function syncDiagSteps() {
    const strip = $('.diag-steps');
    if (!strip) return;
    const isDone = key => key==='sources' ? state.sources.length>0 : key==='scan' ? state.scanDone : key==='mcp' ? state.mcpDone : state.scanDone;
    let firstOpen = null;
    API.stage1.steps.forEach(s=>{ if(!isDone(s.key) && firstOpen===null) firstOpen = s.key; });
    strip.querySelectorAll('.diag-step').forEach(btn=>{
      const key = btn.dataset.diag;
      const complete = isDone(key);
      const current = !complete && key === firstOpen;
      btn.classList.toggle('done', complete);
      btn.classList.toggle('current', current);
      const mark = $('.diag-mark', btn);
      if (mark) mark.innerHTML = complete ? icon('check') : String(API.stage1.steps.findIndex(s=>s.key===key)+1);
      const go = $('.diag-go', btn);
      if (go) go.textContent = complete ? '已完成' : current ? '运行' : '待办';
      // A step that just turned done pops its mark, quietly.
      if (complete && !btn.dataset.done) { const m=$('.diag-mark',btn); if(m) motion.pop(m,{scale:1.4,duration:.5}); }
      btn.dataset.done = complete ? '1' : '';
    });
  }
  function mcpSteps() {    return ['解构仓库与工具入口','生成技能包契约','沙箱验毒流程模拟','生成待上架清单'].map((name,i)=>{
      const complete = state.mcp >= (i+1)*25;
      const active = !complete && jobs.has('mcp') && Math.floor(state.mcp/25)===i;
      // The bar shows how far the current step has come, not the step boundary.
      const within = active ? (state.mcp%25)*4 : 0;
      // The bar lives in every step so it can be updated in place; only the
      // running one shows it.
      const bar = `<div class="progress-bar${active?'':' is-hidden'}" id="mcpProgress${i}" role="progressbar" aria-label="${escape(name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${within}"><div class="progress-fill" data-value="${within}" style="transform:scaleX(${within/100})"></div></div>`;
      return `<li class="task-step ${complete?'completed':active?'active':''}" data-mcp-step="${i}"><span class="step-mark">${complete?icon('check'):i+1}</span><div class="step-info"><strong>${name}</strong><p data-mcp-label="${i}">${complete?'已完成':active?'演示运行中':'等待执行'}</p>${bar}</div></li>`;
    }).join('');
  }
  // Only the running step is touched while the job advances.
  function syncMcpStep(index) {
    const row = $(`#mcpSteps .task-step[data-mcp-step="${index}"]`);
    if (!row) return;
    const complete = state.mcp >= (index+1)*25;
    const active = !complete && jobs.has('mcp') && Math.floor(state.mcp/25)===index;
    row.className = `task-step ${complete?'completed':active?'active':''}`;
    const mark = $('.step-mark', row);
    if (mark) mark.innerHTML = complete ? icon('check') : String(index+1);
    const label = $('[data-mcp-label]', row);
    if (label) label.textContent = complete ? '已完成' : active ? '演示运行中' : '等待执行';
    const bar = $('.progress-bar', row);
    if (bar) {
      bar.classList.toggle('is-hidden', !active);
      if (active) { const within=(state.mcp%25)*4; bar.setAttribute('aria-valuenow',within); const fill=$('.progress-fill',bar); if(fill){fill.dataset.value=within; motion.fillTo(fill,within/100,{duration:.2});} }
    }
    if (complete) {
      motion.focusStep(row);
      const mark = $('.step-mark', row);
      if (mark) motion.pop(mark, {scale:1.45, duration:.5});
    }
  }
  function chatMessages() { return state.messages.map(m => `<div class="chat-message ${m.role==='user'?'user':''}"><div class="chat-author">${m.role==='user'?'你':'架构师 · 本地演示'}</div><div class="chat-bubble">${escape(m.text)}</div></div>`).join(''); }
  // ---- The prototype preview ----------------------------------------------
  // The prototype is the thing the user actually wants to look at, so it gets
  // the whole width of the work area and a device frame that says which size
  // is being shown. The three sizes are the three that matter to a buyer
  // signing off a procurement system: the desk it is used at, the tablet it
  // is approved on, and the phone it is checked on.
  const deviceSizes = {
    desktop: {label:'桌面', icon:'desktop', width:null, height:null},
    tablet:  {label:'平板', icon:'tablet',  width:834,  height:1000},
    phone:   {label:'手机', icon:'phone',   width:390,  height:760}
  };
  function prototypeFrame() {
    const d = deviceSizes[state.device];
    return `<section class="card prototype-panel">
      <div class="card-header">
        <h2 class="card-title">${icon('eye')} 原型预览</h2>
        <div class="prototype-actions">
          <div class="seg-control device-switch" role="tablist" aria-label="预览设备尺寸">
            <span class="seg-indicator" aria-hidden="true"></span>
            ${Object.entries(deviceSizes).map(([key,v])=>`<button type="button" role="tab" data-action="device" data-device="${key}" aria-selected="${state.device===key}" aria-label="${v.label}预览" title="${v.label}预览">${icon(v.icon)}<span>${v.label}</span></button>`).join('')}
          </div>
          <a class="icon-button proto-open-new" href="prototype-view.html" target="_blank" rel="noopener" aria-label="在新标签页打开原型" title="在新标签页打开原型">${icon('external')}</a>
          <button class="btn btn-primary" data-action="open-prototype-view">大屏查看 ${icon('expand')}</button>
        </div>
      </div>
      <div class="prototype-stage" data-device="${state.device}">
        <div class="browser-frame">
          <div class="browser-toolbar">
            <span class="browser-lock" aria-hidden="true"></span>
            <span class="browser-address">procurement.local / 采购审批</span>
            <span class="browser-actions"><span class="browser-refresh" aria-hidden="true"></span></span>
          </div>
          <div class="browser-viewport" data-device="${state.device}">
            <iframe title="采购审批系统原型预览" src="prototype-demo.html" loading="lazy"></iframe>
          </div>
        </div>
      </div>
      <p class="card-note prototype-note">采购审批系统的原始业务原型，在浏览器外壳中预览，可直接点击操作。「大屏查看」在工作台内推入全页视图，「全屏打开」在新页面中以独立视口呈现。</p>
    </section>`;
  }
  // The size of the frame is what the device switch actually changes, so the
  // switch is not a decoration: it changes what is on screen. Both the
  // embedded panel and the full-page view share one device state, so every
  // stage element that carries a device attribute follows along.
  function applyDevice() {
    $$('.prototype-stage, .proto-page').forEach(el => { el.dataset.device = state.device; });
    $$('[data-action="device"]').forEach(el => el.setAttribute('aria-selected', String(el.dataset.device === state.device)));
    updateDeviceIndicator();
    persist();
  }
  // The capsule travels within the switch that is on screen. The embedded
  // switch lives in stage 2; the full-page view has one of its own, so the
  // indicator of whichever switch is visible is placed.
  function updateDeviceIndicator() {
    const track = $('.device-switch:not([hidden])');
    const active = $('[data-action="device"][aria-selected="true"]', track);
    const cap = $('.seg-indicator', track);
    if (!track || !active || !cap) return;
    const origin = track.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    const x = rect.left - origin.left;
    if (cap.dataset.placed) motion.capsule(cap, {x, width:rect.width, duration:.45});
    else {
      cap.dataset.placed = '1';
      if (window.gsap) gsap.set(cap, {x, width:rect.width, autoAlpha:1});
      else { cap.style.transform=`translateX(${x}px)`; cap.style.width=`${rect.width}px`; cap.style.opacity='1'; }
    }
  }
  // ---- The full-page prototype view ---------------------------------------
  // The prototype is the thing the person actually wants to look at. Inside
  // stage 2 it fills the work area's width; the "全屏查看" button pushes a
  // page of its own — a large framed prototype and nothing around it — the
  // way the run log is a page of its own. One element is shared with the
  // embedded panel, so the device chosen in either place is the device shown
  // in both.
  function prototypeViewMarkup() {
    const d = deviceSizes[state.device];
    return `<section class="proto-page" data-device="${state.device}" aria-label="原型预览">
      <div class="proto-page-head">
        <div class="proto-page-heading">
          <div class="stage-index">原型预览 · 采购审批</div>
          <h1 class="stage-title">采购审批系统原型</h1>
          <p class="stage-subtitle">原始业务原型，可直接点击操作。切换设备尺寸，查看对应布局。</p>
        </div>
        <div class="proto-page-actions">
          <div class="seg-control device-switch" role="tablist" aria-label="预览设备尺寸">
            <span class="seg-indicator" aria-hidden="true"></span>
            ${Object.entries(deviceSizes).map(([key,v])=>`<button type="button" role="tab" data-action="device" data-device="${key}" aria-selected="${state.device===key}" aria-label="${v.label}预览" title="${v.label}预览">${icon(v.icon)}<span>${v.label}</span></button>`).join('')}
          </div>
          <button class="btn btn-secondary" data-action="open-prototype-page">新标签页打开 ${icon('external')}</button>
          <button class="btn btn-primary" data-action="close-pushed-view">返回工作台 ${icon('arrow')}</button>
        </div>
      </div>
      <div class="proto-page-stage">
        <div class="browser-frame">
          <div class="browser-toolbar">
            <span class="browser-lock" aria-hidden="true"></span>
            <span class="browser-address">procurement.local / 采购审批</span>
            <span class="browser-actions"><span class="browser-refresh" aria-hidden="true"></span></span>
          </div>
          <div class="browser-viewport">
            <iframe title="采购审批系统原型预览" src="prototype-demo.html" loading="eager"></iframe>
          </div>
        </div>
      </div>
      <p class="proto-page-note">此为可交互的真实原型页面。点击审批按钮、筛选与快捷操作即可体验流程；导出或接入真实服务需连接后端。</p>
    </section>`;
  }
  function openPrototypeView() {
    if (state.pushed) return;
    state.view = 'work';
    state.pushed = 'prototype';
    const logView = $('#logView');
    const stageViews = $('#stageViews');
    if (logView) logView.hidden = true;
    if (stageViews) stageViews.hidden = true;
    const holder = $('#prototypeView');
    holder.hidden = false;
    holder.innerHTML = prototypeViewMarkup();
    icons(holder);
    $$('.stage-pill').forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
    $('.nav-stages')?.classList.add('is-dimmed');
    const indicator = $('.nav-indicator');
    if (indicator && window.gsap && hasMotion()) gsap.to(indicator,{autoAlpha:0,duration:.2,ease:EASE.out,overwrite:true});
    else if (indicator) indicator.style.opacity = '0';
    requestAnimationFrame(updateDeviceIndicator);
    if (hasMotion() && window.gsap) {
      // The page arrives as a stack: the whole sheet settles, then the title
      // masks in and the browser frame rises into place. Two manners, so the
      // view reads as a page opening, not a single fade.
      const proto = holder.querySelector('.proto-page');
      gsap.fromTo(proto,{y:14,autoAlpha:.4},{y:0,autoAlpha:1,duration:.34,ease:EASE.out,clearProps:'transform,opacity,visibility'});
      const title = holder.querySelector('.proto-page-heading .stage-title');
      if (title) gsap.from(title,{yPercent:90,autoAlpha:0,duration:.5,delay:.12,ease:EASE.expo,clearProps:'transform,opacity,visibility'});
      const frame = holder.querySelector('.proto-page-stage');
      if (frame) gsap.from(frame,{y:12,autoAlpha:0,duration:.4,delay:.2,ease:EASE.out,clearProps:'transform,opacity,visibility'});
    }
    const announcer = $('#announce');
    if (announcer) announcer.textContent = '原型预览';
    addLog('info','打开原型预览全页视图');
  }
  function hidePushedView({silent = false} = {}) {
    if (!state.pushed) return;
    state.pushed = null;
    const holder = $('#prototypeView');
    if (holder) { holder.hidden = true; holder.innerHTML = ''; }
    const stageViews = $('#stageViews');
    if (stageViews) stageViews.hidden = false;
    $('.nav-stages')?.classList.remove('is-dimmed');
    $$('.stage-pill').forEach(el => {
      const active = Number(el.dataset.stage) === state.currentStage;
      el.classList.toggle('active', active);
      if (active) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
    });
    updateIndicator();
    if (!silent) { const announcer = $('#announce'); if (announcer) announcer.textContent = `工段 ${state.currentStage} / 5 · ${titles[state.currentStage-1]}`; }
  }
  // The embedded panel keeps its open-in-page link so the keyboard user and
  // the pointer user take the same path: the "全屏查看" button in stage 2.
  function openEmbeddedPrototypePage() {
    if (state.pushed) { hidePushedView(); return; }
    openPrototypeView();
  }
  // A new bubble is appended rather than the thread rebuilt: the user's line comes
  // from the right, the architect's rises from below, so the two read differently.
  function appendChat(role,text) {
    const box = $('#chatMessages');
    if (!box) return;
    const node = document.createElement('div');
    node.className = `chat-message ${role==='user'?'user':''}`;
    node.innerHTML = `<div class="chat-author">${role==='user'?'你':'架构师 · 本地演示'}</div><div class="chat-bubble"><span class="chat-bubble-text">${escape(text)}</span></div>`;
    box.append(node);
    box.scrollTop = box.scrollHeight;
    if (role==='user') motion.slideIn(node,{from:14,duration:.34});
    else {
      // An assistant reply settles with a spring and its text discloses in
      // place, so the reply reads as something being said, not dropped.
      motion.riseIn(node,{duration:.4,distance:8});
      const bubble = $('.chat-bubble-text', node);
      if (bubble) {
        const lines = bubble.textContent.split('\n').length;
        if (hasMotion() && window.gsap && lines > 1) {
          gsap.from(bubble, {y:4, autoAlpha:0, duration:.4, delay:.18, ease:EASE.out, clearProps:'transform,opacity,visibility'});
        }
      }
    }
  }
  function stage2() {
    return header(2,'需求与契约','先对齐需求，再锁定契约：左边对齐需求与契约，右边实时预览原型效果，中间分隔条可拖动调整。',btn(`${icon('check')} 批准并启动制造演示`,'approve',true,'id="approveBtn"')) +
      `<div class="req-split" id="reqSplit" style="--req-split:${state.reqSplit}%">
        <section class="req-pane req-left">
          <div class="req-pane-head"><h2>${icon('chat')} 需求与契约</h2><span class="muted" id="reqReqCount">${state.requirements.length} 条补充需求</span></div>
          <div class="req-pane-body">
            <section class="card chat-panel req-chat">
              <div class="card-header"><h2 class="card-title">${icon('chat')} 架构师对话</h2><span class="badge badge-neutral">本地规则回复</span></div>
              <div class="chat-messages" id="chatMessages" role="log" aria-live="polite">${chatMessages()}</div>
              <form class="chat-composer" id="chatForm"><label class="sr-only" for="chatInput">补充业务需求</label><textarea id="chatInput" placeholder="补充角色、权限或审批要求…" rows="2" maxlength="1200" required></textarea><button class="btn btn-secondary" type="submit" id="chatSend">发送</button></form>
            </section>
            <section class="card req-contracts">
              <div class="card-header"><h2 class="card-title">${icon('file')} 三大契约</h2><span class="muted">已写入 ${state.requirements.length} 条补充需求</span></div>
              <div class="card-body">
                <div class="contract-grid">${contractFiles().map((f,i)=>`<button class="contract-item" data-action="contract" data-index="${i}">${icon(i===0?'layers':i===1?'link':'code')}<strong>${f.name}</strong><span>${f.desc}${icon('arrow')}</span></button>`).join('')}</div>
                <div class="requirement-trace"><div class="section-header"><h3 class="card-title">已写入契约的需求</h3><span class="muted" id="requirementTraceCount">${state.requirements.length} 条</span></div><ul class="requirement-list" id="requirementList">${requirementList()}</ul></div>
                <div class="approval-row"><p id="approvalHint">尚未批准 · 先检查契约与业务边界</p></div>
              </div>
            </section>
          </div>
        </section>
        <div class="req-divider" id="reqDivider" role="separator" aria-orientation="vertical" aria-label="调整需求与预览的分隔" tabindex="0"><span class="req-grip">${icon('grip')}</span></div>
        <section class="req-pane req-right">
          <div class="req-pane-head"><h2>${icon('browser')} 原型预览</h2><span class="muted">浏览器外壳 · 可交互</span></div>
          <div class="req-pane-body">${prototypeFrame()}</div>
        </section>
      </div>` + footer('拖动分隔条调整两侧大小；Enter 发送，Shift + Enter 换行。',3,'查看制造产线');
  }
  function stage3() {
    const fileTree = fileTreeMarkup();
    const open = state.openFile !== null ? API.stage3.files[state.openFile] : API.stage3.files[0];
    return header(3,'四路产线','四路协作，一份契约：按数据库、后端、前端与技能四条产线制造，产物文件可在下方实时查看。',btn(`${icon('play')} 开始制造`,'build',true,'id="buildBtn"')) +
      `<div class="notice" id="buildNotice">制造前需要批准原型契约。当前进度为浏览器内演示，不会执行真实代码生成。</div><div class="swarm-grid">${API.stage3.swarms.map((s,i)=>`<section class="card swarm-card"><h3>${escape(s.name)}</h3><div class="progress-label"><span id="swarmState${i}">待启动</span><strong id="swarmPercent${i}">0%</strong></div>${progress(0,s.name,`swarmProgress${i}`)}<div class="swarm-output" id="swarmOutput${i}">${['schema.sql / 仿真数据','FastAPI / RBAC','Vue 3 / 审批表单','技能包 / 容器配置'][i]}</div></section>`).join('')}</div>` +
      `<div class="explorer-panel">
        <div class="explorer-head"><h2>${icon('filetree')} 制造产物</h2><span class="muted">点击文件查看代码</span></div>
        <div class="explorer-body">
          <aside class="file-tree" id="fileTree" aria-label="产物文件树">
            <div class="file-tree-head"><span>文件</span><span class="file-tree-count" id="fileTreeCount">${API.stage3.files.length} 个</span></div>
            <div class="tree-list">${fileTree}</div>
          </aside>
          <section class="code-viewer" id="codeViewer" aria-label="文件代码">
            <div class="code-viewer-head"><span class="code-viewer-path">${icon('doc')} ${escape(open.path)}</span><button class="text-button" data-action="copy-file">${icon('copy')} 复制</button></div>
            <div class="code-viewer-langs"><span class="code-viewer-lang">${escape(open.lang)}</span><span>${escape(open.label)}</span></div>
            <pre class="code-block code-file" id="codeFile"><code>${escape(open.code)}</code></pre>
          </section>
        </div>
      </div>` +
      `<div style="margin-top:18px">${card(`${icon('shield')} 契约守卫`,`<ul class="log-list" id="guardLogs"><li class="empty-state">启动制造演示后，守卫记录会显示在这里。</li></ul>`)}</div>` + footer('产物文件随制造进度逐步解锁；内容为演示样例。',4,'前往质检自愈');
  }
  function fileTreeMarkup() {
    // Group by lane with a label; the tree mirrors the four lanes.
    const laneNames = ['数据库','后端','前端','技能与部署'];
    return laneNames.map((name, lane)=>{
      const files = API.stage3.files.filter(f=>f.lane===lane);
      if (!files.length) return '';
      const iconFor = lang => lang==='sql'?'database':lang==='vue'?'code':lang==='markdown'?'doc':'file';
      return `<div class="tree-group"><div class="tree-group-name">${escape(name)}</div>${files.map(f=>{
        const idx = API.stage3.files.indexOf(f);
        return `<button class="tree-item ${state.openFile===idx?'active':''}" data-action="open-file" data-index="${idx}">${icon(iconFor(f.lang))}<span>${escape(f.path.split('/').pop())}</span></button>`;
      }).join('')}</div>`;
    }).join('');
  }
  function syncFileTree() {
    const el = $('#fileTree');
    if (!el) return;
    el.querySelector('.tree-list').innerHTML = fileTreeMarkup();
  }
  // Opening a file in the explorer swaps the code view without rebuilding the
  // whole stage, so the file tree keeps its place and the code arrives.
  function openArtifactFile(index) {
    const file = API.stage3.files[Number(index)];
    if (!file) return;
    // The tree row that was chosen is announced the moment it is chosen, so a
    // fast click still lands on the right file.
    state.openFile = Number(index);
    syncFileTree();
    const viewer = $('#codeViewer');
    if (!viewer) return;
    const head = $('.code-viewer-path', viewer);
    if (head) head.innerHTML = `${icon('doc')} ${escape(file.path)}`;
    const lang = $('.code-viewer-lang', viewer);
    if (lang) lang.textContent = file.lang;
    const code = $('#codeFile');
    if (code) {
      code.innerHTML = `<code>${escape(file.code)}</code>`;
      motion.wipeIn(code, {duration:.3});
      // The tree row pops to confirm the choice, so the reader's eye lands
      // where the code came from.
      const row = $(`.tree-item[data-index="${state.openFile}"]`);
      if (row) motion.slideIn(row, {from:2, duration:.2});
    }
    addLog('info',`查看制造产物 / ${file.path}`);
  }
  function stage4() {
    return header(4,'质检与自愈','在浏览器中执行检查与自愈：左边是视觉巡航的真实浏览器视图，右边是后端攻防与问题闭环。',btn(`${icon('play')} 运行质检演示`,'qa',true,'id="qaBtn"')) +
      `<div class="notice" id="qaNotice">尚未运行质检。以下为模拟演示，不连接真实沙箱或浏览器测试服务。</div><div class="qa-layout">
        <section class="qa-browser card">
          <div class="qa-browser-head">
            <h2 class="card-title">${icon('browser')} 浏览器检查 · 视觉巡航</h2>
            <span class="badge badge-neutral" id="qaBadge">待运行</span>
          </div>
          <div class="qa-browser-shell">
            <div class="qa-browser-toolbar">
              <span class="qa-browser-nav" aria-hidden="true">←</span><span class="qa-browser-nav" aria-hidden="true">→</span>
              <span class="qa-browser-address"><span class="browser-lock" aria-hidden="true"></span>${API.stage4.frontend.url}</span>
              <button class="qa-browser-reload" data-action="qa-reload" aria-label="刷新浏览器视图" title="刷新浏览器视图">${icon('refresh')}</button>
            </div>
            <div class="qa-browser-viewport" id="qaBrowserViewport" aria-label="被检查的应用页面">
              <div class="qa-page" id="qaPage">
                <div class="qa-page-nav"><span class="qa-brand">国企采购</span><span>采购审批</span><span>资产管理</span><span>供应商</span><span>报表中心</span></div>
                <div class="qa-page-body">
                  <div class="qa-page-head"><h3>采购审批</h3><p>待处理 3 项 · 本月已审批 127 项</p></div>
                  <div class="qa-kpi-row"><div><span>本页待处理金额</span><strong>¥556,300</strong></div><div><span>待审批订单</span><strong>3</strong></div><div><span>本月已审批</span><strong>127</strong></div></div>
                  <div class="qa-page-table">
                    <div class="qa-tr qa-th"><span>订单编号</span><span>采购物资</span><span class="qa-amount">金额</span><span>状态</span><span>操作</span></div>
                    <div class="qa-tr"><span>PO202406001</span><span>办公桌椅 50 套</span><span class="qa-amount">¥87,500</span><span class="qa-pill">待初审</span><span class="qa-act">审批</span></div>
                    <div class="qa-tr"><span>PO202406002</span><span>打印机耗材</span><span class="qa-amount">¥12,800</span><span class="qa-pill">待初审</span><span class="qa-act">审批</span></div>
                    <div class="qa-tr"><span>PO202406003</span><span>服务器设备</span><span class="qa-amount">¥456,000</span><span class="qa-pill qa-pill-urgent">待终审</span><span class="qa-act">审批</span></div>
                  </div>
                  <div class="qa-page-fab">＋ 新建采购单</div>
                </div>
              </div>
              <span class="test-cursor" id="testCursor"><svg viewBox="0 0 18 24" fill="currentColor"><path d="M1 1v19l5-5 4 8 4-2-4-8h7Z"/></svg></span>
            </div>
          </div>
          <ol class="step-list qa-step-list" id="qaSteps">${qaSteps()}</ol>
        </section>
        <div class="qa-side">
          ${card(`${icon('shield')} 后端红蓝对抗`,`<div class="test-metrics"><div class="lead"><strong id="attackCount">0</strong><span>并发攻击轮次</span></div><div><strong id="breachCount">0</strong><span>捕获问题</span></div><div><strong id="fixedCount">0</strong><span>模拟修复</span></div></div><ul class="issue-list" id="qaIssues">${qaIssueRows()}</ul><ul class="log-list" id="qaLogs"><li class="empty-state">等待启动攻防演示</li></ul>`,`<span class="badge badge-neutral">沙箱模拟</span>`)}
          ${card(`${icon('eye')} 巡航检查结果`,`<ul class="qa-checks" id="qaChecks">${qaChecks()}</ul>`)}
        </div>
      </div>` + footer('可重复运行；运行期间按钮锁定，避免重复任务。',5,'查看交付清单');
  }
  function qaChecks() {
    return API.stage4.frontend.checks.map((c,i)=>{
      const done = state.qaStep > i;
      return `<li class="qa-check ${done?'pass':''}" data-check="${i}"><span class="qa-check-mark">${done?icon('check'):'·'}</span><span class="qa-check-el">${escape(c.el)}</span><span class="qa-check-pass">${done?'已通过':c.pass}</span></li>`;
    }).join('');
  }
  function syncQaChecks() {
    const el = $('#qaChecks');
    if (!el) return;
    // Only the check that just turned pass is touched, so a running sequence
    // reads as one check finishing at a time rather than a full redraw.
    const prev = state.qaStep - 1;
    el.innerHTML = qaChecks();
    const fresh = el.querySelector(`.qa-check[data-check="${prev}"]`);
    if (fresh) {
      const mark = $('.qa-check-mark', fresh);
      if (mark) motion.pop(mark, {scale:1.6, duration:.55});
      motion.slideIn(fresh, {from:-6, duration:.3});
    }
  }
  function qaSteps() { return API.stage4.frontend.steps.map((s,i)=>`<li class="task-step ${state.qaStep>i?'completed':jobs.has('qa')&&state.qaStep===i?'active':''}" data-step="${i}"><span class="step-mark">${state.qaStep>i?icon('check'):i+1}</span><div class="step-info"><strong>${escape(s.desc)}</strong><p>${state.qaStep>i?'场景演示完成':jobs.has('qa')&&state.qaStep===i?'正在模拟':'等待巡航'}</p></div></li>`).join(''); }
  // Only the step that changed is rewritten: rebuilding the whole list on every
  // tick made the finished steps flicker and lost their transition.
  function syncQaStep(index) {
    const row = $(`#qaSteps .task-step[data-step="${index}"]`);
    if (!row) return;
    const desc = API.stage4.frontend.steps[index]?.desc || '';
    const done = state.qaStep > index;
    const active = jobs.has('qa') && state.qaStep === index;
    row.className = `task-step ${done?'completed':active?'active':''}`;
    const mark = $('.step-mark', row);
    if (mark) mark.innerHTML = done ? icon('check') : String(index+1);
    const p = $('.step-info p', row);
    if (p) p.textContent = done ? '场景演示完成' : active ? '正在模拟' : '等待巡航';
    if (done) {
      motion.focusStep(row);
      const mark = $('.step-mark', row);
      if (mark) motion.pop(mark, {scale:1.45, duration:.5});
    }
  }
  function stage5() {
    // Deliverables are listed as a manifest with their real state, not four identical cards.
    const files = [
      { title:'项目快照', desc:'当前接入资产、对话、各工段状态与演示运行记录。', action:'export-session', format:'JSON', ready:true },
      { title:'契约文件包', desc:'数据库、API、组件树契约与补充需求，整合为 JSON。', action:'download-contracts', format:'JSON', ready:true },
      { title:'质量演示报告', desc:'本地质检时间线、完成步骤与模拟问题修复记录。', action:'download-report', format:'Markdown', ready:state.qaDone, id:'reportDownload' },
      { title:'技能待上架清单', desc:'发票核验与库存锁技能的示例元数据；外部发布尚未接入。', action:'download-skills', format:'JSON', ready:true }
    ];
    const ready = files.filter(f=>f.ready), blocked = files.filter(f=>!f.ready);
    const item = f => `<li class="manifest-row ${f.ready?'':'locked'}"><div class="manifest-info"><strong>${f.title}</strong><p>${f.desc}</p></div><span class="manifest-format">${f.format}</span><button class="btn btn-secondary" data-action="${f.action}" ${f.id?`id="${f.id}"`:''} ${f.ready?'':'disabled'}>${icon('download')}<span>${f.ready?'导出':'未就绪'}</span></button></li>`;
    // The skill list belongs to the manifest: it is the content of the
    // "待上架清单" export, not a separate deliverable of its own.
    const skills = `<section class="card skill-card"><div class="card-header"><h2 class="card-title">${icon('layers')} 待上架技能</h2><span class="muted">示例元数据</span></div><div class="card-body"><ul class="skill-list" id="skillList">${skillRows()}</ul><p class="card-note">本地演示不提交 PR，也不向外部服务发布；上架需接入 SkillHub 后端。</p></div></section>`;
    return header(5,'交付清单','让交付有据可查：汇总契约、演示报告与项目记录，保留每一步的上下文。') +
      `<div class="delivery-summary"><div><h2>采购系统现代化 · 交付工作区</h2><p>Struts 1.x → Vue 3 + FastAPI · 目标架构示例</p></div><span class="badge badge-neutral" id="deliveryBadge">尚待完成制造与质检演示</span></div>` +
      `<section class="card manifest-card"><div class="card-header"><h2 class="card-title">${icon('file')} 交付清单</h2><span class="muted">${ready.length} / ${files.length} 项可导出</span></div><div class="card-body"><ul class="manifest-list">${ready.map(item).join('')}</ul>${blocked.length?`<div class="manifest-blocked"><p class="manifest-blocked-title">尚不可导出</p><ul class="manifest-list">${blocked.map(item).join('')}</ul><p class="manifest-hint" id="reportHint">需先完成质检演示，才能导出报告。</p></div>`:''}</div></section>` +
      skills + footer('导出内容为本地演示资料，不包含真实生产源码或部署包。',1,'返回资产接入');
  }
  // The skill rows carry their own facts, and their status follows the
  // conversion demo rather than a hard-coded label.
  function skillRows() {
    return API.stage5.skills.map(s=>`<li class="skill-row"><div><strong>${escape(s.name)}</strong><p>${escape(s.fact)} · ${escape(s.version)}</p></div><span class="badge ${state.mcpDone?'badge-success':'badge-neutral'}">${state.mcpDone?'已生成':'未生成'}</span></li>`).join('');
  }
  function render() {
    // The explorer opens on the first artifact by default, so the code view is
    // never empty on first visit.
    if (state.openFile === null) state.openFile = 0;
    $('#stageViews').innerHTML = [stage1,stage2,stage3,stage4,stage5].map((fn,i)=>`<section class="stage-view" data-view="${i+1}" ${i+1===state.currentStage?'':'hidden'} aria-label="${titles[i]}">${fn()}</section>`).join('');
    renderSources(); renderAgents(); icons(); syncDiagSteps();
  }
  // Everything the reset touches, drawn from scratch in one pass.
  function renderAll() {
    render();
    renderLogs(true);
    syncLogCount();
    refreshApproval();
    resetPipeline();
    renderRail();
    updateIndicator();
  }
  function renderSources() {
    // The selected source follows what the user opened, not the first entry.
    $('#sourceList').innerHTML = state.sources.map((s,i)=>`<button class="source-item ${i===state.selectedSource?'selected':''}" data-action="source" data-index="${i}">${icon(s.icon)}<span class="source-info"><span class="source-name" style="display:block">${escape(s.name)}</span><span class="source-status" style="display:block">${escape(s.status)}</span></span></button>`).join('') + `<button class="source-item" data-action="add-source">${icon('plus')}<span class="source-name">添加新源</span></button>`;
    const total = $('#sourceTotal'); if (total) total.innerHTML = `<span class="stat-number" data-count="${state.sources.length}">${state.sources.length}</span><small>项</small>`;
  }
  function renderAgents() {
    // Which lane is running is read from the job that owns it, so a new lane
    // never has to be taught to this function twice.
    const statuses = API.agents.map((a,i)=>{
      const job = a.job;
      const running = job ? jobs.has(job) : false;
      const laneActive = running && (a.lane===undefined || lanesRunning(job).has(a.lane));
      const text = laneActive ? '演示运行中'
        : job==='build' && state.buildProgress[a.lane]===100 ? '演示完成'
        : a.name==='架构师' && state.approved ? '契约已批准'
        : '待命';
      return {name:a.name,status:laneActive?'working':'ready',text};
    });
    // The count reads in words: "0 个运行中 / 共 9 个角色" says what the
    // fraction means, where "0 / 9" only says two numbers.
    const working = statuses.filter(a=>a.status==='working').length;
    $('#agentCount').textContent = `${working} 个运行中 / 共 ${statuses.length} 个角色`;
    $('#agentList').innerHTML = statuses.map((a,i)=>`<button class="agent-item" data-action="agent" data-index="${i}"><span class="agent-status ${a.status}"></span><span class="agent-info"><span class="agent-name" style="display:block">${escape(a.name)}</span><span class="agent-state" style="display:block">${a.text}</span></span></button>`).join('');
  }
  // The lanes a job currently occupies, so the agent list can show which ones
  // are actually moving rather than lighting up every agent of that job.
  function lanesRunning(job) {
    if (job === 'build') {
      const running = new Set();
      state.buildProgress.forEach((v,i)=>{ if (v>0 && v<100) running.add(i); });
      if (!running.size && state.buildProgress.some(v=>v===100)) state.buildProgress.forEach((v,i)=>{ if(v===100) running.add(i); });
      return running;
    }
    return new Set();
  }
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.motion = state.motion;
    $('#themeToggle').innerHTML = icon(state.theme==='dark'?'sun':'moon');
    $('#themeToggle').setAttribute('aria-label',`切换${state.theme==='dark'?'浅色':'深色'}模式`);
    $('#themeToggle').setAttribute('aria-pressed',String(state.theme==='dark'));
  }
  function toast(text, kind = 'info') {
    const region = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icon(kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'chat')}<span>${escape(text)}</span>`;
    region.append(el);
    while (region.children.length > 3) region.firstElementChild.remove();
    // A banner is dismissed by touching it. Tapping it away is the gesture
    // everyone already expects from the platform, so the banner does the
    // obvious thing rather than making the user wait.
    const dismiss = () => {
      if (!el.isConnected) return;
      motion.travel(el, {y:8, autoAlpha:0, duration:.2, onComplete:()=>el.remove()});
    };
    el.addEventListener('click',dismiss,{once:true});
    motion.riseIn(el, {duration:.25, distance:12});
    setTimeout(dismiss, 3200);
  }
  function logMarkup(log) { return `<div class="terminal-line" data-seq="${log.seq}"><time class="log-time">${escape(log.time)}</time><span class="log-${log.type}">${escape(log.text)}</span></div>`; }
  // The terminal appends a line rather than rebuilding itself: a full rebuild on every
  // entry threw away scroll position and made arriving lines impossible to animate.
  // The badge counts what has happened since the log was last opened, not the
  // whole history. A badge that always shows the total is a badge the eye
  // learns to ignore, and then it says nothing when it should.
  function syncLogCount() {
    const badge = $('#mobileLogCount');
    if (!badge) return;
    const unread = Math.max(0, state.logs.length - state.logSeen);
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.dataset.empty = unread === 0 ? 'true' : 'false';
  }
  function renderLogs(force = false) {
    const el = $('#terminalBody');
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    const list = state.logsPaused ? state.pausedLogs : state.logs;
    const filtered = list.filter(l => state.logFilter==='all'||l.type===state.logFilter);
    el.innerHTML = filtered.length ? filtered.map(logMarkup).join('') : '<div class="empty-state">暂无匹配记录</div>';
    $('#logCount').textContent = `${filtered.length} 条记录${state.logsPaused?' · 已暂停显示':''}`;
    syncLogCount();
    if (bottom || force) el.scrollTop = el.scrollHeight;
  }
  // Append one line to whatever is currently on screen, then let it arrive.
  function appendLog(log) {
    const el = $('#terminalBody');
    if (!el) return;
    const empty = $('.empty-state', el);
    if (empty) empty.remove();
    const node = document.createElement('div');
    node.innerHTML = logMarkup(log);
    const line = node.firstElementChild;
    el.append(line);
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (near) el.scrollTop = el.scrollHeight;
    motion.logIn(line);
  }
  function addLog(type,text) {
    const entry = {seq:state.logSeq++, time:new Date().toLocaleTimeString('zh-CN',{hour12:false}), type:['info','success','warning','error'].includes(type)?type:'info', text:String(text)};
    state.logs.push(entry);
    if (state.logs.length>200) state.logs.splice(0,state.logs.length-200);
    $('#logCount').textContent = `${state.logs.filter(l=>state.logFilter==='all'||l.type===state.logFilter).length} 条记录${state.logsPaused?' · 已暂停显示':''}`;
    syncLogCount();
    if (state.logsPaused) { state.pausedLogs?.push(entry); return; }
    if (state.logFilter==='all'||state.logFilter===entry.type) appendLog(entry);
  }
  const wait = (ms, signal) => new Promise((resolve,reject)=>{
    if (signal.aborted) { reject(new DOMException('Cancelled','AbortError')); return; }
    const abort = () => {clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
    const timer = setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
  // A running job can be stopped. The run button keeps its own identity and a
  // separate stop control appears beside it, so a second click on "run" can
  // never be mistaken for "stop".
  const stoppable = { scan:1, mcp:1, build:1, qa:1 };
  async function runJob(name,buttonId,fn,{onAbort}={}) {
    if (jobs.has(name)) return;
    const controller = new AbortController(); jobs.set(name,controller);
    const button = document.getElementById(buttonId), original = button?.innerHTML;
    const canStop = stoppable[name];
    let stopButton = null, group = null;
    if (button) {
      button.setAttribute('aria-busy','true');
      if (canStop) {
        button.classList.add('is-running');
        button.innerHTML = '<span class="busy-icon" aria-hidden="true"></span> 运行中';
        stopButton = document.createElement('button');
        stopButton.type = 'button';
        stopButton.className = 'btn btn-secondary job-stop';
        stopButton.dataset.stopJob = name;
        stopButton.innerHTML = `${icon('close')} 中止`;
        stopButton.setAttribute('aria-label',`中止${jobLabels[name] || '任务'}`);
        // The pair travels together, so a card header keeps its two-sided layout.
        group = document.createElement('span');
        group.className = 'job-controls';
        button.insertAdjacentElement('beforebegin', group);
        group.append(button, stopButton);
        motion.popIn(stopButton);
      } else {
        button.disabled = true;
        button.innerHTML = '<span class="busy-icon" aria-hidden="true"></span> 运行中';
      }
    }
    renderAgents();
    try { await fn(controller.signal); }
    catch(error) {
      if (error.name==='AbortError') {
        addLog('warning',`${jobLabels[name] || '任务'}已中止`);
        toast('任务已中止，已恢复到可继续的状态');
        onAbort?.();
      } else {
        addLog('error',`操作未完成：${error.message}`);
        toast('操作未完成，请重试','error');
      }
    }
    finally {
      jobs.delete(name);
      if (button) {
        button.disabled=false;
        button.removeAttribute('aria-busy');
        button.classList.remove('is-running');
        button.innerHTML=original;
      }
      // The run button went back to where it started when the pair was grouped.
      if (group && button) {
        const parent = group.parentNode;
        if (parent) parent.insertBefore(button, group);
        group.remove();
      }
      stopButton?.remove();
      renderAgents();
      renderRail();
    }
  }
  const jobLabels = { scan:'扫描演示', mcp:'MCP 转化演示', build:'制造演示', qa:'质检演示', chat:'需求记录', demo:'流程导览' };
  function scan() {
    return runJob('scan','scanBtn',async signal=>{
      state.scan=0; state.scanDone=false;
      $('#scanBadge').className='badge badge-neutral'; $('#scanBadge').textContent='扫描中';
      for (const [i,label] of ['识别构建文件与框架','解析核心表关系','整理漏洞与废弃依赖','完成示例诊断报告'].entries()) {
        $('#scanLabel').textContent=label; addLog('info',`扫描演示 / ${label}`);
        await wait(650,signal); state.scan=(i+1)*25; setProgress('scanProgress',state.scan); $('#scanPercent').textContent=`${state.scan}%`;
      }
      state.scanDone=true; $('#scanBadge').className='badge badge-success'; $('#scanBadge').textContent='演示完成';
      state.sources[0].status='示例 / 扫描完成'; renderSources(); refreshOverview(); syncDiagSteps(); addLog('warning','示例诊断：12 个高危漏洞待后续处理'); toast('扫描演示完成，诊断结果已整理','success');
    },{onAbort:()=>{
      state.scan=0; state.scanDone=false;
      const badge=$('#scanBadge'); if(badge){badge.className='badge badge-neutral';badge.textContent='已中止';}
      const label=$('#scanLabel'); if(label) label.textContent='演示已中止，可重新开始';
      const pct=$('#scanPercent'); if(pct) pct.textContent='0%';
      setProgress('scanProgress',0);
      refreshOverview();
      syncDiagSteps();
    }});
  }
  // The strip shows what is known now: a figure that only the scan produces
  // stays a dash until the scan has actually run.
  function refreshOverview() {
    $$('.overview-stat').forEach((el,i)=>{
      const stat = API.stage1.stats[i]; if (!stat) return;
      const number = el.querySelector('.stat-number');
      const unit = el.querySelector('small');
      const pending = !stat.live && !state.scanDone;
      if (pending) { if (number) { number.textContent='—'; delete number.dataset.count; } if (unit) unit.textContent=''; el.classList.add('is-pending'); return; }
      el.classList.remove('is-pending');
      const value = stat.live ? state.sources.length : stat.value;
      if (number) { number.dataset.count=String(value); number.textContent=String(value); }
      if (unit) unit.textContent=stat.unit;
      const strong = el.querySelector('strong');
      if (strong && stat.risk) strong.classList.add('risk');
    });
  }
  function mcp() {
    return runJob('mcp','mcpBtn',async signal=>{
      state.mcp=0; state.mcpDone=false;
      $('#mcpSteps').innerHTML=mcpSteps();
      // The step advances continuously, so the bar inside the running step is never blank.
      for (let step=0; step<4; step++) {
        for (let t=0; t<5; t++) {
          await wait(160,signal);
          state.mcp = step*25 + t*5;
          syncMcpStep(step);
        }
        addLog('info',`MCP 转化演示 / 步骤 ${step+1} 完成`);
      }
      state.mcp=100; state.mcpDone=true;
      $('#mcpSteps').innerHTML=mcpSteps();
      const list=$('#skillList'); if(list) list.innerHTML=skillRows();
      state.sources[1].status='示例 / 已生成清单'; renderSources(); syncDiagSteps(); toast('转化演示完成，技能待上架','success');
    },{onAbort:()=>{
      state.mcp=0; state.mcpDone=false;
      const steps=$('#mcpSteps'); if(steps) steps.innerHTML=mcpSteps();
      syncDiagSteps();
      const list=$('#skillList'); if(list) list.innerHTML=skillRows();
    }});
  }
  function refreshApproval() {
    $('#approvalHint').textContent=state.approved?'演示契约已批准 · 可运行制造流程':'尚未批准 · 先检查契约与业务边界';
    $('#approveBtn').innerHTML=state.approved?`${icon('check')} 查看制造产线`:`${icon('check')} 批准并启动制造演示`;
    $('#buildNotice').textContent=state.approved?'契约已批准。可启动或重新运行本地制造演示。':'制造前需要批准原型契约。当前进度为浏览器内演示，不会执行真实代码生成。';
    // The blocking state is the one notice that asks for attention.
    $('#buildNotice').className=state.approved?'notice':'notice attention';
    updateDelivery();
  }
  function approve() {
    if (state.chatBusy) { toast('请等待需求记录完成后再批准'); return; }
    if (jobs.has('build') || jobs.has('qa')) { switchStage(jobs.has('qa')?4:3); toast('当前任务正在运行'); return; }
    if (state.approved) { switchStage(3); return; }
    openDialog('批准演示契约',`<p class="notice">你将确认当前三份演示契约与 ${state.requirements.length} 条补充需求，并启动浏览器本地制造演示。此操作不部署、不发布。</p><div class="data-list">${contractSummary().map(f=>`<div class="data-row"><span><strong>${f.name}</strong><br><span class="muted">${f.desc}</span></span><span class="badge badge-neutral">${escape(f.fact)}</span></div>`).join('')}</div><div class="dialog-actions">${btnQuiet('返回检查','close-dialog')}${btn('确认并开始演示','confirm-approve',true)}</div>`,'approve');
  }
  function build() {
    if (!state.approved) { toast('请先在原型契约工段批准契约'); switchStage(2); return; }
    if (jobs.has('qa')) { toast('请等待质检演示完成后重新制造'); return; }
    return runJob('build','buildBtn',async signal=>{
      state.built=false; state.qaDone=false; state.buildProgress.fill(0); state.qaEvents=[]; state.qaStep=0;
      $('#qaSteps').innerHTML=qaSteps(); $('#qaLogs').innerHTML='<li class="empty-state">制造重新开始，等待重新质检</li>';
      resetQaCounters();
      $('#qaBadge').textContent='待运行'; $('#qaBadge').className='badge badge-neutral'; $('#qaNotice').textContent='制造重新开始。请在完成后重新运行质检演示。';
      updateDelivery(); $('#guardLogs').replaceChildren(); $('#buildNotice').textContent='本地制造演示运行中 · 四条产线按契约推进';
      for(let tick=1;tick<=10;tick++) {
        await wait(420,signal);
        API.stage3.swarms.forEach((swarm,i)=>{
          const value=Math.min(100,Math.round(tick*(13-i*.9))); state.buildProgress[i]=value;
          setProgress(`swarmProgress${i}`,value);
          const pct=$(`#swarmPercent${i}`); if(pct) pct.textContent=`${value}%`;
          const st=$(`#swarmState${i}`); if(st) st.textContent=value===100?'演示完成':'制造演示中';
          if (value===100) {
            const box=$(`#swarmOutput${i}`);
            if(box && !box.dataset.filled) {
              box.dataset.filled='true';
              box.innerHTML=swarm.output.map(t=>`<span class="swarm-line ${t.done?'done':''}">${icon(t.done?'check':'play')}<span>${escape(t.text)}</span></span>`).join('');
              // Each lane's output arrives in its own order, so four lanes that
              // finish together still read as four separate results.
              $$('.swarm-line',box).forEach((line,k)=>motion.slideIn(line,{from:-6,delay:k*.09,duration:.34}));
              // The card that just filled acknowledges it once, quietly.
              const card = box.closest('.swarm-card');
              if (card) {
                const head = $('h3', card);
                const mark = $('.swarm-line.done .icon:first-child', box);
                if (mark) motion.pop(mark, {scale:1.5, duration:.5});
                if (head) motion.flash(head, 'positive');
              }
            }
          }
        });
        if ([3,6,9].includes(tick)) {
          const log=API.stage3.guardLogs[tick/3-1];
          $('#guardLogs').insertAdjacentHTML('beforeend',`<li class="event-row success"><time>${new Date().toLocaleTimeString('zh-CN',{hour12:false})}</time>${icon('check')}<span>${escape(log.text)} · 模拟</span></li>`);
          const row=$('#guardLogs').lastElementChild; if(row) motion.slideIn(row,{from:-6,duration:.3});
          addLog('success',`契约校验演示 / ${log.text}`);
        }
      }
      state.built=true; $('#buildNotice').textContent='四路制造演示完成。接下来可运行质检场景。'; updateDelivery(); toast('制造演示完成，可以开始质检','success');
    },{onAbort:()=>{
      state.built=false; state.buildProgress.fill(0);
      state.buildProgress.forEach((_,i)=>{setProgress(`swarmProgress${i}`,0);const p=$(`#swarmPercent${i}`);if(p)p.textContent='0%';const s=$(`#swarmState${i}`);if(s)s.textContent='已中止';const o=$(`#swarmOutput${i}`);if(o){delete o.dataset.filled; o.textContent=['schema.sql / 仿真数据','FastAPI / RBAC','Vue 3 / 审批表单','技能包 / 容器配置'][i];}});
      const notice=$('#buildNotice'); if(notice) notice.textContent='制造演示已中止。重新开始时进度会从头计算。';
      updateDelivery();
    }});
  }
  const qaIssueRows = () => QA_SCENARIO.issues.map((issue,i)=>{
    const fixed = state.qaStep > issue.fixedAt;
    const found = state.qaStep > issue.foundAt;
    return `<li class="issue-row ${fixed?'fixed':found?'found':''}" data-issue="${i}"><span class="issue-mark">${fixed?icon('check'):found?icon('alert'):i+1}</span><div class="issue-info"><strong>${escape(issue.name)}</strong><p>${escape(issue.detail)}</p></div><span class="issue-state">${fixed?'已修复':found?'已捕获':'待发现'}</span></li>`;
  }).join('');
  // The three counters go back to zero and forget that they have rolled, so
  // the next run can roll them again.
  function resetQaCounters() {
    ['attackCount','breachCount','fixedCount'].forEach(id=>{
      const el=$('#'+id);
      if(!el)return;
      el.textContent='0';
      delete el.dataset.counted;
      delete el.dataset.rolled;
      delete el.dataset.rollShape;
    });
  }
  function qa() {
    if (!state.built) { toast('请先完成制造演示，再开始质检'); switchStage(state.approved?3:2); return; }
    return runJob('qa','qaBtn',async signal=>{
      state.qaDone=false; state.qaStep=0; state.qaEvents=[]; updateDelivery();
      $('#qaLogs').replaceChildren(); $('#qaBadge').textContent='运行中'; $('#qaBadge').className='badge badge-neutral';
      $('#qaNotice').textContent='正在模拟攻击、问题捕获、修复与页面巡航；不执行真实安全测试。';
      resetQaCounters();
      syncQaChecks();
      const page = $('#qaPage');
      if (page) { page.classList.remove('qa-page-progress-2','qa-page-progress-4','qa-page-clean'); }
      // The inspected page loads in as a page would: nav, then the head, then
      // the figures, then the rows. The cursor only moves once the page is up.
      if (hasMotion() && window.gsap && page) {
        gsap.fromTo('#qaBrowserViewport',{filter:'brightness(1)'},{filter:'brightness(1.25)',duration:.12,yoyo:true,repeat:1,ease:'none',clearProps:'filter'});
        gsap.from(page.querySelectorAll('.qa-page-nav'),{y:-6,autoAlpha:0,duration:.3,ease:EASE.out,clearProps:'transform,opacity,visibility'});
        gsap.from(page.querySelectorAll('.qa-page-head'),{y:6,autoAlpha:0,duration:.3,delay:.05,ease:EASE.out,clearProps:'transform,opacity,visibility'});
        gsap.from(page.querySelectorAll('.qa-kpi-row>div'),{y:6,autoAlpha:0,duration:.3,stagger:.05,delay:.12,ease:EASE.out,clearProps:'transform,opacity,visibility'});
        gsap.from(page.querySelectorAll('.qa-tr'),{y:6,autoAlpha:0,duration:.3,stagger:.05,delay:.2,ease:EASE.out,clearProps:'transform,opacity,visibility'});
      }
      const issues=$('#qaIssues');
      if (issues) issues.innerHTML=qaIssueRows();
      const events=QA_SCENARIO.steps;
      for(let i=0;i<events.length;i++) {
        syncQaStep(i);
        const cursor=$('#testCursor');
        // The cursor travels on the shared easing and is reset on abort, so a
        // second run starts from the origin rather than a stale offset.
        motion.travel(cursor,{x:i%2?28:-28,y:i*22,autoAlpha:1,duration:.6});
        await wait(750,signal);
        state.qaStep=i+1; const {type,text}=events[i]; const log={time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),type,text}; state.qaEvents.push(log);
        $('#qaLogs').insertAdjacentHTML('beforeend',`<li class="event-row ${type}"><time>${log.time}</time>${icon(type==='warning'?'alert':'check')}<span>${escape(text)}</span></li>`);
        const eventRow = $('#qaLogs').lastElementChild;
        if (eventRow) motion.slideIn(eventRow,{from:-6,duration:.3});
        // The counters follow the scenario, not a hard-coded pair of numbers.
        // Each one rolls to its value, the way a counter in a panel does.
        motion.rollTo($('#attackCount'),QA_SCENARIO.rounds);
        if(i>=1) motion.rollTo($('#breachCount'),QA_SCENARIO.issues.length);
        if(i>=3) motion.rollTo($('#fixedCount'),QA_SCENARIO.issues.filter(x=>x.fixedAt<=i).length);
        // The inspected page marks the two stages that change it: after the
        // form and after the approval flow. Everything else is the same page.
        if (page) {
          if (i===1) page.classList.add('qa-page-progress-2');
          if (i===3) page.classList.add('qa-page-progress-4');
        }
        syncQaChecks();
        const issueList=$('#qaIssues');
        if(issueList){issueList.innerHTML=qaIssueRows();const last=issueList.lastElementChild;if(last&&last.classList.contains('fixed'))motion.slideIn(last,{from:-6,duration:.28});}
        syncQaStep(i);
        addLog(type,`质检演示 / ${text}`);
      }
      $('#testCursor').style.opacity='0'; state.qaDone=true; $('#qaSteps').innerHTML=qaSteps(); $('#qaBadge').textContent='演示完成'; $('#qaBadge').className='badge badge-success';
      if (page) page.classList.add('qa-page-clean');
      motion.flash($('#qaBadge'),'positive');
      $('#qaNotice').textContent='模拟流程已完成。可导出演示报告；实际验收仍需连接后端与浏览器测试服务。'; updateDelivery(); toast('质检场景演示完成，报告已可导出','success');
    },{onAbort:()=>{
      state.qaDone=false; state.qaStep=0; state.qaEvents=[];
      const badge=$('#qaBadge'); if(badge){badge.textContent='已中止';badge.className='badge badge-neutral';}
      const notice=$('#qaNotice'); if(notice) notice.textContent='质检演示已中止。可重新运行，已捕获的问题记录保留在运行记录中。';
      const cursor=$('#testCursor'); if(cursor) cursor.style.opacity='0';
      const steps=$('#qaSteps'); if(steps) steps.innerHTML=qaSteps();
      const page=$('#qaPage'); if(page){page.classList.remove('qa-page-progress-2','qa-page-progress-4','qa-page-clean');}
      updateDelivery();
    }});
  }
  function updateDelivery() {
    const badge=$('#deliveryBadge'), download=$('#reportDownload'), hint=$('#reportHint');
    if (badge) {
      badge.textContent=state.qaDone?'制造与质检演示已完成':state.built?'制造演示完成 · 待质检':'尚待完成制造与质检演示';
      badge.className=`badge ${state.qaDone?'badge-success':'badge-neutral'}`;
    }
    if (download) {
      download.disabled=!state.qaDone;
      download.title=state.qaDone?'导出本地质检演示报告':'完成质检演示后可导出';
    }
    if (hint) hint.textContent=state.qaDone?'报告内容对应当前已完成的质检演示。':state.built?'需先完成质检演示，才能导出报告。':'需先完成制造与质检演示，才能导出报告。';
    // The moment the last stage completes, the delivery summary celebrates it
    // once when it is seen: the badge pops and the summary warms. The flag is
    // recorded here (delivery state change) and played in animateStage, so the
    // celebration happens when the user actually looks at the stage.
    if (state.qaDone && !updateDelivery._ready) {
      updateDelivery._ready = true;
    }
    if (!state.qaDone) updateDelivery._ready = false;
    // The stage actions say what they can do, so a button is never a trap
    // that bounces the user back with a toast. The build button waits for
    // approval; the QA button waits for a finished build. While a job runs,
    // runJob manages the button itself, so these rules only shape the resting
    // states.
    const qaBtn=$('#qaBtn'), buildBtn=$('#buildBtn');
    if (qaBtn && !jobs.has('qa')) {
      const ready = state.built;
      qaBtn.disabled = !ready;
      qaBtn.title = ready ? '运行质检演示' : '需先完成制造演示，再开始质检';
    }
    if (buildBtn && !jobs.has('build')) {
      buildBtn.disabled = !state.approved;
      buildBtn.title = state.approved ? '开始制造演示' : '需先在原型契约工段批准契约';
    }
  }
  function sendChat(form) {
    if(state.chatBusy || jobs.has('build') || jobs.has('qa')) { toast('任务进行中，请完成后再修改需求'); return; }
    const input=$('#chatInput'), text=input.value.trim(); if(!text) return;
    if(state.requirements.length>=30) { toast('本次演示最多记录 30 条补充需求'); return; }
    state.messages.push({role:'user',text}); state.requirements.push(text); input.value=''; state.approved=false; resetPipeline(); refreshApproval(); syncRequirementTrace();
    $('#chatMessages').innerHTML=''; state.messages.slice(0,-1).forEach(m=>appendChat(m.role,m.text)); appendChat('user',text);
    state.chatBusy=true; input.disabled=true;
    runJob('chat','chatSend',async signal=>{
      await wait(650,signal);
      const reply=/角色|权限|导出|财务/.test(text)?'已将角色与权限要求记入契约备注。请核对各角色的导出范围；敏感财务字段建议默认脱敏。':/审批|紧急|流程/.test(text)?'已记录审批流程补充要求。现有演示仍保留三级审批与发票核验；新增流程需要在后端状态机中进一步实现。':'已将这条需求写入契约备注。你可以点击下方契约文件检查，确认后重新批准。';
      state.messages.push({role:'architect',text:reply}); appendChat('architect',reply); addLog('info',`已记录第 ${state.requirements.length} 条补充需求`);
    }).finally(()=>{state.chatBusy=false;input.disabled=false;});
  }
  function openDialog(title,body,kind='detail') {
    if(state.demo)stopDemo();
    const dialog=$('#appDialog');
    const isNew = !dialog.open;
    if(isNew)dialogFocus=document.activeElement;
    dialogKind=kind; $('#dialogTitle').textContent=title; $('#dialogBody').innerHTML=body;
    if(isNew)dialog.showModal();
    dialog.scrollTop=0; icons(dialog);
    // The panel only animates when it opens; a content swap inside an open
    // panel reads as a re-render, not as an arrival. On a phone the panel is
    // a sheet and rises from the bottom edge; on a desktop it is a window
    // and grows from its own centre.
    if(isNew) {
      if(matchMedia('(max-width:620px)').matches) motion.sheetIn(dialog);
      else motion.popIn(dialog);
    }
  }
  function closeDialog() { $('#appDialog').close(); }
  // The push that carries you between stages has a matching gesture: a swipe
  // from the edge of the work area goes back one stage, a swipe the other way
  // goes forward. It is bound to touch only, and it stays out of the way of
  // anything that scrolls sideways.
  function bindStageSwipe() {
    const main = $('#workspace');
    if (!main) return;
    let startX = 0, startY = 0, tracking = false, decided = false, horizontal = false;
    const onDown = event => {
      if (event.pointerType !== 'touch' || !event.isPrimary) return;
      // A swipe that starts on a control is a press, not a swipe.
      if (event.target.closest('button,a,input,select,textarea,table,.terminal-body,.dialog-tabs,#reqDivider')) return;
      tracking = true;
      decided = false;
      horizontal = false;
      startX = event.clientX;
      startY = event.clientY;
    };
    const onMove = event => {
      if (!tracking) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      // The gesture only becomes a swipe once it is clearly sideways. Until
      // then it might be a scroll, and stealing it would break the page.
      if (!decided && Math.abs(dx) > 12) {
        decided = true;
        horizontal = Math.abs(dx) > Math.abs(dy) * 1.4;
      }
      if (!horizontal) return;
      // A swipe that began in the middle of the content is not a navigation.
      if (event.cancelable) event.preventDefault();
    };
    const onUp = event => {
      if (!tracking) return;
      tracking = false;
      if (!horizontal) return;
      const dx = event.clientX - startX;
      if (Math.abs(dx) < 72) return;
      const dir = dx < 0 ? 1 : -1;
      const next = state.currentStage + dir;
      if (next < 1 || next > 5) return;
      switchStage(next, {focus:true});
    };
    main.addEventListener('pointerdown',onDown,{signal:lifecycle.signal});
    main.addEventListener('pointermove',onMove,{signal:lifecycle.signal,passive:false});
    main.addEventListener('pointerup',onUp,{signal:lifecycle.signal});
    main.addEventListener('pointercancel',()=>{tracking=false;},{signal:lifecycle.signal});
  }
  // A sheet on a phone is dismissed by throwing it downward. The gesture is
  // given a grab bar, because a sheet with no handle is a panel, and a panel
  // that moves under your thumb is a bug.
  function bindSheetDrag() {
    const dialog = $('#appDialog');
    if (!dialog) return;
    const phone = () => matchMedia('(max-width:620px)').matches;
    let dragging = false, startY = 0, offset = 0, pointerId = null;
    const grab = () => {
      let bar = $('.sheet-grab', dialog);
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'sheet-grab';
        bar.setAttribute('aria-hidden','true');
        dialog.prepend(bar);
      }
      return bar;
    };
    const onDown = event => {
      if (!phone() || !event.isPrimary) return;
      // Only the grab bar starts a drag. A drag that began on a scrollable
      // list would fight the list.
      if (!event.target.closest('.sheet-grab')) return;
      dragging = true;
      startY = event.clientY;
      offset = 0;
      pointerId = event.pointerId;
      dialog.classList.add('is-dragging');
      // Capturing the pointer keeps the drag going if the finger leaves the
      // bar. It can refuse a pointer it does not know, and a refused capture
      // must not stop the drag.
      try { event.target.closest('.sheet-grab').setPointerCapture?.(event.pointerId); } catch { /* the drag works without it */ }
    };
    const onMove = event => {
      if (!dragging || event.pointerId !== pointerId) return;
      offset = Math.max(0, event.clientY - startY);
      if (window.gsap && hasMotion()) gsap.set(dialog, {y:offset});
      else dialog.style.transform = `translateY(${offset}px)`;
    };
    const onUp = event => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      dialog.classList.remove('is-dragging');
      // Thrown far enough or thrown fast enough and the sheet goes; otherwise
      // it returns to where it was. The distance threshold is a third of the
      // sheet's height, so a short sheet still needs a decisive gesture.
      const far = offset > Math.min(160, dialog.offsetHeight / 3);
      if (far && window.gsap && hasMotion()) {
        gsap.to(dialog, {y:dialog.offsetHeight,duration:.26,ease:EASE.inout,onComplete:()=>{dialog.close();dialog.style.transform='';}});
      } else if (far) {
        dialog.close();
      } else if (window.gsap && hasMotion()) {
        gsap.to(dialog, {y:0,duration:.34,ease:EASE.out,clearProps:'transform'});
      } else {
        dialog.style.transform = '';
      }
    };
    dialog.addEventListener('pointerdown',onDown,{signal:lifecycle.signal});
    dialog.addEventListener('pointermove',onMove,{signal:lifecycle.signal});
    dialog.addEventListener('pointerup',onUp,{signal:lifecycle.signal});
    dialog.addEventListener('pointercancel',onUp,{signal:lifecycle.signal});
    // The grab bar only exists on a phone, where the panel is a sheet.
    if (matchMedia('(max-width:620px)').matches) grab();
  }
  function resetPipeline() {
    state.built=false;state.qaDone=false;state.buildProgress.fill(0);state.qaStep=0;state.qaEvents=[];
    state.buildProgress.forEach((_,i)=>{setProgress(`swarmProgress${i}`,0);const p=$(`#swarmPercent${i}`);if(p)p.textContent='0%';const s=$(`#swarmState${i}`);if(s)s.textContent='待启动';const o=$(`#swarmOutput${i}`);if(o){o.textContent=['schema.sql / 仿真数据','FastAPI / RBAC','Vue 3 / 审批表单','技能包 / 容器配置'][i];delete o.dataset.filled;}});
    $('#guardLogs').innerHTML='<li class="empty-state">契约已更新，等待重新制造。</li>';
    $('#qaSteps').innerHTML=qaSteps();$('#qaLogs').innerHTML='<li class="empty-state">契约已更新，等待重新质检。</li>';
    resetQaCounters();
    const issues=$('#qaIssues'); if(issues) issues.innerHTML=qaIssueRows();
    $('#qaBadge').textContent='待运行';$('#qaBadge').className='badge badge-neutral';$('#qaNotice').textContent='契约已更新，需要重新制造并质检。';
    const cursor=$('#testCursor'); if(cursor){cursor.style.opacity='0';cursor.style.transform='translate(0,0)';}
    const page=$('#qaPage'); if(page){page.classList.remove('qa-page-progress-2','qa-page-progress-4','qa-page-clean');}
    syncQaChecks();
  }
  function addSourceDialog() {
    openDialog('接入新资产',`<p class="notice">保存项目来源信息以供演示。此处不上传文件，也不读取远程仓库。</p><form id="sourceForm"><div class="field"><label for="sourceName">资产名称</label><input id="sourceName" name="name" placeholder="例如：固定资产管理系统" maxlength="60" required autofocus></div><div class="field"><label for="sourceKind">资产类型</label><select id="sourceKind" name="kind"><option>源码项目</option><option>MCP 工具</option><option>业务需求</option></select></div><div class="field"><label for="sourceLocation">来源地址或说明</label><textarea id="sourceLocation" name="location" placeholder="HTTPS 仓库地址、文件名或需求说明" maxlength="500" required></textarea><small>仅保存至当前页面会话，导出快照可留档。</small></div><p class="form-error" id="sourceError" role="alert"></p><div class="dialog-actions">${btn('取消','close-dialog')}<button class="btn btn-primary" type="submit">添加资产</button></div></form>`,'source');
  }
  function saveSource(form) {
    const data=new FormData(form),name=String(data.get('name')).trim(),location=String(data.get('location')).trim(),kind=String(data.get('kind'));
    const error=$('#sourceError');
    if(!name||!location){error.textContent='请填写资产名称和来源说明。';return;}
    if(state.sources.length>=20){error.textContent='本次演示最多接入 20 项资产。';return;}
    if(state.sources.some(s=>s.name===name)){error.textContent='该资产名称已存在，请使用不同名称。';return;}
    if(/^[a-z][a-z\d+.-]*:/i.test(location)){
      try{const url=new URL(location);if(url.protocol!=='https:'||url.username||url.password)throw new Error();}catch{error.textContent='仓库地址请使用不包含凭据的 HTTPS 链接，或直接填写文件名。';return;}
    }
    state.sources.push({name,kind,location,status:'已登记 / 未分析',icon:kind==='MCP 工具'?'link':kind==='业务需求'?'file':'folder'});
    renderSources(); closeDialog(); addLog('info',`登记新资产：${name}`); toast('资产信息已添加','success');
  }
  function showSource(index) {
    const s=state.sources[index];if(!s)return;
    state.selectedSource=index;
    // Scoped to the sidebar: the document also holds the 已接入资产 dialog's
    // own list, and the two share one index space.
    $$('.sidebar-left .source-item').forEach((el,i)=>el.classList.toggle('selected',i===index));
    openDialog(s.name,`<dl class="source-details"><dt>资产类型</dt><dd>${escape(s.kind)}</dd><dt>来源</dt><dd>${escape(s.location)}</dd><dt>当前状态</dt><dd>${escape(s.status)}</dd><dt>处理方式</dt><dd>${index<2?'内置示例，可运行对应场景演示。':'已登记来源，尚未连接分析服务。'}</dd></dl><div class="dialog-actions">${btn('关闭','close-dialog')}</div>`);
  }
  function showSources() {
    openDialog('已接入资产',`<p class="card-note">${state.sources.length} 项资产 · 点击查看来源信息。</p><div class="source-list">${state.sources.map((s,i)=>`<button class="source-item" data-action="source" data-index="${i}">${icon(s.icon)}<span class="source-info"><span class="source-name" style="display:block">${escape(s.name)}</span><span class="source-status" style="display:block">${escape(s.status)}</span></span>${icon('arrow')}</button>`).join('')}</div><div class="dialog-actions">${btn('接入新资产','add-source',true)}</div>`,'sources');
  }
  function showContract(index=0) {
    state.contractTab=Number(index)||0; const files=contractFiles(),file=files[state.contractTab];if(!file)return;
    const lines=file.text.split('\n').length;
    const body=`<div class="dialog-tabs" role="tablist" aria-label="契约文件"><span class="seg-indicator" aria-hidden="true"></span>${files.map((f,i)=>`<button role="tab" id="contractTab${i}" aria-controls="contractCode" tabindex="${i===state.contractTab?0:-1}" data-action="contract-tab" data-index="${i}" aria-selected="${i===state.contractTab}">${f.name}</button>`).join('')}</div><div class="contract-meta"><span>${escape(file.desc)}</span><span>${lines} 行</span></div><pre class="code-block" id="contractCode" role="tabpanel" aria-labelledby="contractTab${state.contractTab}" tabindex="0"><code>${escape(file.text)}</code></pre><div class="dialog-actions">${btn(`${icon('copy')} 复制`,'copy-contract')}${btn(`${icon('download')} 下载文件`,'download-contract',true)}</div>`;
    const swapped = dialogKind==='contract' && $('#appDialog').open;
    openDialog('检查契约文件',body,'contract');
    // Swapping files is a wipe down the panel, not a full-panel fade.
    if (swapped) motion.wipeIn($('#contractCode'),{duration:.34});
    // The three files are a segmented control: one capsule marks the file
    // that is open, and it travels there on the spring. When the panel has
    // just been opened the capsule is placed; when a file is swapped it
    // travels from the old one to the new.
    updateSegment({travel:swapped});
    $(`#contractTab${state.contractTab}`).focus();
  }
  // The capsule behind the selected tab. The dialog is rebuilt on every
  // swap, so the capsule is placed rather than travelled when the panel
  // itself has just opened.
  function updateSegment({travel=false}={}) {
    const tabs=$('.dialog-tabs'), seg=$('.seg-indicator', tabs);
    const active=$('button[aria-selected="true"]', tabs);
    if(!tabs||!seg||!active)return;
    const originLeft=tabs.getBoundingClientRect().left;
    const rect=active.getBoundingClientRect();
    const top=active.offsetTop;
    if(window.gsap&&hasMotion()) {
      gsap.set(seg,{height:active.offsetHeight,top});
      if(travel) motion.capsule(seg,{x:rect.left-originLeft,width:rect.width,duration:.45});
      else { seg.dataset.placed='1'; gsap.set(seg,{x:rect.left-originLeft,width:rect.width,autoAlpha:1}); }
      return;
    }
    seg.style.height=`${active.offsetHeight}px`;
    seg.style.top=`${top}px`;
    seg.style.transform=`translateX(${rect.left-originLeft}px)`;
    seg.style.width=`${rect.width}px`;
    seg.style.opacity='1';
  }
  async function copyText(text,trigger) {
    // Two ways to copy, in order: the async clipboard, then the old
    // execCommand. The second one still matters where the clipboard API is
    // blocked or denied.
    const viaCommand = () => {
      const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;opacity:0;';
      ($('#appDialog').open?$('#dialogBody'):document.body).append(field);
      const prev=document.activeElement;field.select();
      const ok=document.execCommand('copy');field.remove();prev?.focus();
      if(!ok)throw new Error('copy rejected');
    };
    try {
      if(navigator.clipboard&&window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); }
        catch { viaCommand(); }
      } else { viaCommand(); }
      toast('已复制到剪贴板','success');
      // The button confirms in place instead of only in a toast, so the eye
      // stays on the thing that was just copied.
      if(trigger&&trigger.isConnected)flashCopied(trigger);
    } catch {toast('无法自动复制，请选中文本手动复制','error');}
  }
  // A copy button keeps its own label until the copy actually happened, then
  // shows the result for a moment and returns to rest.
  function flashCopied(el){
    if(el.dataset.copiedTimer){clearTimeout(Number(el.dataset.copiedTimer));}
    // The markup is kept, not just the text, so the icon returns with the label.
    const markup=el.dataset.copyMarkup||(el.dataset.copyMarkup=el.innerHTML);
    const label=el.dataset.copyLabel||(el.dataset.copyLabel=el.textContent.trim());
    el.classList.add('is-copied');
    el.textContent='已复制';
    el.setAttribute('aria-label',`${label}，已复制`);
    el.dataset.copiedTimer=String(setTimeout(()=>{
      el.classList.remove('is-copied');
      el.innerHTML=markup;
      el.setAttribute('aria-label',label);
      delete el.dataset.copiedTimer;
    },1600));
  }
  // A file is served as the format its name claims, so the downloaded bundle is
  // machine-readable as itself rather than as plain text.
  const contractMime = name => name.endsWith('.yaml')||name.endsWith('.yml') ? 'text/yaml;charset=utf-8'
    : name.endsWith('.json') ? 'application/json;charset=utf-8'
    : name.endsWith('.md') ? 'text/markdown;charset=utf-8'
    : 'text/plain;charset=utf-8';
  function download(filename,content,type='application/json;charset=utf-8') {
    const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    // Revoked on the next tick, not after a fixed second: long enough for the
    // browser to start the transfer, short enough not to hold the blob in memory.
    setTimeout(()=>URL.revokeObjectURL(url),10000);
    toast('文件已生成，浏览器将开始下载','success');
  }
  function snapshot(){return {product:'磐石智造',mode:'browser-local-demo',exportedAt:new Date().toISOString(),sources:state.sources,stage:state.currentStage,scanDemoComplete:state.scanDone,mcpDemoComplete:state.mcpDone,contractApproved:state.approved,manufacturingDemoComplete:state.built,qualityDemoComplete:state.qaDone,requirements:state.requirements,messages:state.messages,logs:state.logs};}
  function exportJSON(name,value){download(name,JSON.stringify(value,null,2));addLog('success',`已导出 ${name}`);}
  function downloadReport(){
    if(!state.qaDone){toast('完成质检演示后才能导出报告');return;}
    download('panshi-quality-demo.md',`# 磐石智造 · 质检演示报告\n\n> 浏览器本地模拟，不是真实安全测试或生产验收证明。\n\n导出时间：${new Date().toLocaleString('zh-CN')}\n\n## 场景结果\n\n- 模拟并发轮次：${QA_SCENARIO.rounds}\n- 模拟问题：${QA_SCENARIO.issues.length}\n- 模拟修复：${QA_SCENARIO.issues.filter(x=>x.fixedAt<=state.qaStep).length}\n- 前端巡航：${state.qaStep} / ${QA_SCENARIO.steps.length} 步\n\n## 捕获的问题\n\n${QA_SCENARIO.issues.map(i=>`- ${i.name}：${i.detail}（${state.qaStep>i.fixedAt?'已修复':'未修复'}）`).join('\n')}\n\n## 时间线\n\n${state.qaEvents.map(e=>`- ${e.time} ${e.text}`).join('\n')}\n\n## 后续接入\n\n真实代码生成、沙箱攻防、浏览器端测、容器交付与 SkillHub 发布需后端服务支持。\n`,'text/markdown;charset=utf-8');addLog('success','已导出质量演示报告');
  }
  // A demo that cannot be restarted is a dead end. Resetting returns every
  // stage, requirement and log to its starting state.
  function resetDemo() {
    if (jobs.size) { toast('请先等待当前任务结束'); return; }
    openDialog('重置演示',`<p class="notice">这会清空本会话里的资产、需求、演示进度与运行记录，回到初始状态。主题与动效偏好保留。</p><div class="dialog-actions">${btnQuiet('取消','close-dialog')}${btn('确认重置','confirm-reset',true)}</div>`,'reset');
  }
  function doReset() {
    state.sources.length = 0;
    state.sources.push(...[
      {name:'老旧国企采购系统',kind:'源码项目',location:'legacy-procurement.zip',status:'示例 / 待扫描',icon:'folder'},
      {name:'发票核验 MCP',kind:'MCP 工具',location:'示例 MCP 配置',status:'示例 / 待转化',icon:'link'}
    ]);
    state.logs=[]; state.pausedLogs=null; state.logsPaused=false; state.logFilter='all'; state.logSeq=0; state.logSeen=0;
    state.scan=0; state.scanDone=false; state.mcp=0; state.mcpDone=false;
    state.approved=false; state.built=false; state.qaDone=false; state.qaStep=0; state.qaEvents=[];
    state.buildProgress=API.stage3.swarms.map(()=>0);
    state.messages=API.stage2.cards[0].messages.map(m=>({...m}));
    state.requirements=[]; state.contractTab=0; state.selectedSource=0; state.seen=new Set(); state.scrolls=new Map();
    state.openFile=null; state.reqSplit=46;
    $('#logFilter').value='all'; $('#pauseLogs').textContent='暂停'; $('#pauseLogs').setAttribute('aria-pressed','false');
    renderAll();
    closeDialog();
    addLog('info','演示已重置，回到初始状态');
    toast('演示已重置','success');
  }
  function help(){openDialog('使用工作台',`<div class="shortcut-list"><span>搜索工段与操作</span><kbd>Ctrl / ⌘ K</kbd><span>切换工段</span><kbd>Alt 1 … 5</kbd><span>大屏查看 / 关闭原型预览</span><kbd>Ctrl / ⌘ P</kbd><span>打开运行记录</span><kbd>Ctrl / ⌘ J</kbd><span>收起 / 展开左侧栏</span><kbd>Ctrl / ⌘ \\</kbd><span>收起 / 展开右侧栏</span><kbd>Ctrl / ⌘ ⇧ L</kbd><span>对话发送 / 换行</span><kbd>Enter / Shift Enter</kbd><span>关闭弹窗 / 停止流程演示</span><kbd>Esc</kbd></div><div class="motion-control"><span>减少动态效果</span><button class="btn btn-secondary" data-action="motion" id="motionToggle" aria-pressed="${state.motion==='reduced'}">${state.motion==='reduced'?'已开启':'未开启'}</button></div><p class="notice" style="margin-top:22px;margin-bottom:0">保留系统的减少动态效果设置。项目资产、对话与运行记录仅存于当前会话；主题、动效偏好、当前工段与侧栏状态会保存在浏览器。</p>`,'help');}
  const commands = () => [...titles.map((title,i)=>({label:`前往${title}`,stage:i+1,key:`Alt ${i+1}`})),{label:'接入新资产',action:'add-source',key:'来源'},{label:'扫描项目演示',action:'scan',stage:1},{label:'检查三大契约',action:'contract',stage:2},{label:'大屏查看原型',action:'open-prototype-view',stage:2,key:'Ctrl P'},{label:'运行制造演示',action:'build',stage:3},{label:'运行质检演示',action:'qa',stage:4},{label:'导出项目快照',action:'export-session'},{label:'打开运行记录',action:'open-logs',key:'Ctrl J'},{label:'收起 / 展开左侧栏',action:'toggle-left',key:'Ctrl \\'},{label:'收起 / 展开右侧栏',action:'toggle-right',key:'Ctrl ⇧ L'},{label:'切换深浅主题',action:'theme'},{label:'快捷键与动效偏好',action:'help'}];
  function renderCommands(query='') {
    const list=commands().filter(c=>c.label.toLowerCase().includes(query.toLowerCase().trim()));
    $('#commandList').innerHTML=list.length?list.map(c=>`<button class="command-item" data-action="command" ${c.action?`data-command="${c.action}"`:''} ${c.stage?`data-target="${c.stage}"`:''}><span>${c.label}</span>${c.key?`<kbd>${c.key}</kbd>`:icon('arrow')}</button>`).join(''):'<p class="empty-state">没有匹配操作，试试“契约”或“质检”。</p>';
  }
  function showCommands(){
    // Ctrl+K must not replace the body of a dialog that is already open: doing
    // so would throw away an open contract tab. The palette takes over the
    // dialog only when nothing else is showing.
    if(dialogKind==='commands'&&$('#appDialog').open){const input=$('#commandInput');if(input){input.focus();input.select();return;}}
    if($('#appDialog').open&&dialogKind!=='commands'){toast('请先关闭当前弹窗再搜索操作');return;}
    openDialog('搜索操作',`<label class="sr-only" for="commandInput">搜索工段或操作</label><input class="command-search" id="commandInput" placeholder="搜索工段、契约或操作…" autocomplete="off" autofocus><div class="command-list" id="commandList"></div>`,'commands');renderCommands();$('#commandInput').focus();
  }
  function stopDemo(){const controller=jobs.get('demo');controller?.abort();state.demo=false;$('#demoBtn').textContent='演示流程';$('#demoBtn').setAttribute('aria-pressed','false');clearDemoProgress();}
  // The tour shows where it is, so waiting four seconds per stage is not a
  // black box.
  function demoProgress(step){
    let bar=$('#demoProgress');
    if(!bar){bar=document.createElement('div');bar.id='demoProgress';bar.className='demo-progress';$('#workspace')?.prepend(bar);}
    bar.innerHTML=`<span class="demo-progress-label">流程导览 · 工段 ${step} / 5</span><div class="demo-progress-track"><div class="demo-progress-fill" data-value="${step*20}" style="transform:scaleX(${step*20/100})"></div></div>`;
    const fill=$('.demo-progress-fill',bar);
    if(fill) motion.fillTo(fill,step*20/100,{duration:.5});
  }
  function clearDemoProgress(){const bar=$('#demoProgress');if(bar){bar.remove();}}
  async function demo(){
    if(state.demo){stopDemo();addLog('info','已停止流程演示');return;}
    if(jobs.has('demo'))return;
    state.demo=true;$('#demoBtn').textContent='停止演示';$('#demoBtn').setAttribute('aria-pressed','true');
    addLog('info','开始五工段导览，点击任意工段或按 Esc 可停止');
    await runJob('demo',null,async signal=>{for(let i=1;i<=5;i++){demoProgress(i);switchStage(i,{automatic:true});await wait(4000,signal);}addLog('success','工段导览完成，可手动运行各场景');});
    stopDemo();
  }
  const actions={
    theme:()=>{state.theme=state.theme==='light'?'dark':'light';applyTheme();persist();toast(`已切换${state.theme==='dark'?'深色':'浅色'}模式`);},
    motion:()=>{state.motion=state.motion==='full'?'reduced':'full';stageTimeline?.progress(1).kill();applyTheme();setupMotion();persist();if(dialogKind==='help'){const el=$('#motionToggle');el.textContent=state.motion==='reduced'?'已开启':'未开启';el.setAttribute('aria-pressed',String(state.motion==='reduced'));}},
    scan,mcp,build,qa,demo,approve,help,commands:showCommands,
    'add-source':addSourceDialog,sources:showSources,source:el=>showSource(Number(el.dataset.index)),
    agent:el=>{const a=API.agents[Number(el.dataset.index)];if(a)openDialog(a.name,`<p class="notice">${escape(a.desc||'协作角色。')}</p><p class="card-note">这是本地界面演示中的协作角色，未连接真实智能体服务。</p>`);},
    contract:el=>showContract(Number(el?.dataset?.index)||0),'contract-tab':el=>showContract(Number(el.dataset.index)),
    'confirm-approve':()=>{if(state.chatBusy||jobs.has('build')||jobs.has('qa'))return;state.approved=true;refreshApproval();closeDialog();addLog('success','已批准演示契约');switchStage(3);build();},
    'copy-contract':el=>copyText(contractFiles()[state.contractTab].text,el),
    'download-contract':()=>{const f=contractFiles()[state.contractTab];download(f.name,f.text,contractMime(f.name));},
    'copy-refactor':el=>copyText($('#refactorCode').textContent,el),
    'download-contracts':()=>exportJSON('panshi-contracts.json',{mode:'demo-contracts',files:contractFiles()}),
    'download-report':downloadReport,'download-skills':()=>exportJSON('panshi-skill-manifest.json',{mode:'demo-manifest',published:false,conversionDemoComplete:state.mcpDone,skills:API.stage5.skills.map(({name,version,fact})=>({name,version,fact,status:state.mcpDone?'generated':'not-generated',published:false}))}),
    'export-session':()=>exportJSON('panshi-project-snapshot.json',snapshot()),
    'export-logs':()=>download('panshi-session.log',state.logs.map(l=>`[${l.time}] [${l.type}] ${l.text}`).join('\n'),'text/plain;charset=utf-8'),
    'pause-logs':()=>{state.logsPaused=!state.logsPaused;state.pausedLogs=state.logsPaused?[...state.logs]:null;$('#pauseLogs').textContent=state.logsPaused?'继续':'暂停';$('#pauseLogs').setAttribute('aria-pressed',String(state.logsPaused));renderLogs(true);},
    'clear-logs':()=>{state.logs=[];state.logSeen=0;if(state.logsPaused)state.pausedLogs=[];renderLogs(true);toast('运行记录已清空');},
    'close-dialog':closeDialog,'reset-demo':resetDemo,'confirm-reset':doReset,
    'open-logs':openLogView,'close-logs':()=>leaveLogView(),
    'open-prototype-view':openEmbeddedPrototypePage,'close-pushed-view':()=>hidePushedView(),
    'open-prototype-page':()=>{window.open('prototype-view.html','_blank','noopener');},
    'open-file':el=>openArtifactFile(Number(el.dataset.index)),
    'copy-file':el=>copyText($('#codeFile').textContent,el),
    'qa-reload':()=>{const vp=$('#qaBrowserViewport');if(!vp)return;vp.classList.remove('qa-flash');void vp.offsetWidth;vp.classList.add('qa-flash');addLog('info','刷新浏览器检查视图（模拟）');},
    'toggle-left':()=>togglePanel('left'),'toggle-right':()=>togglePanel('right'),
    device:el=>{
      const d=el?.dataset?.device;
      // Without a button to read, the switch cycles. It is the one control
      // that has a sensible meaning in both directions.
      if(!d){const keys=Object.keys(deviceSizes);state.device=keys[(keys.indexOf(state.device)+1)%keys.length];}
      else{if(!deviceSizes[d])return;state.device=d;}
      applyDevice();
    },    command:el=>{const target=el.dataset.target,action=el.dataset.command;closeDialog();if(target)switchStage(target);if(action)actions[action]?.();}  };
  // The split in the 需求与契约 stage is draggable: the conversation side and
  // the prototype side give up or take width between 28% and 72%. The drag
  // writes a CSS variable, so the panes follow the pointer without reflow.
  // The listeners are delegated to the document, so they survive the stage
  // being rebuilt on a reset.
  function bindReqSplit() {
    let dragging = false, startX = 0, startPct = 0;
    const setSplit = pct => {
      const clamped = Math.min(72, Math.max(28, pct));
      state.reqSplit = clamped;
      const pane = $('#reqSplit');
      if (pane) pane.style.setProperty('--req-split', `${clamped}%`);
      persist();
    };
    const paneWidth = () => {
      const pane = $('#reqSplit');
      return pane ? pane.getBoundingClientRect().width : 1;
    };
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('#reqDivider')) return;
      if (!event.isPrimary) return;
      dragging = true;
      startX = event.clientX;
      startPct = state.reqSplit;
      event.preventDefault();
    }, {signal:lifecycle.signal});
    document.addEventListener('pointermove', event => {
      if (!dragging) return;
      const w = paneWidth();
      setSplit(startPct + (event.clientX - startX) / w * 100);
    }, {signal:lifecycle.signal});
    document.addEventListener('pointerup', () => { dragging = false; }, {signal:lifecycle.signal});
    document.addEventListener('pointercancel', () => { dragging = false; }, {signal:lifecycle.signal});
    document.addEventListener('keydown', event => {
      if (!event.target.closest('#reqDivider')) return;
      if (event.key==='ArrowLeft') { event.preventDefault(); setSplit(state.reqSplit-2); }
      if (event.key==='ArrowRight') { event.preventDefault(); setSplit(state.reqSplit+2); }
      if (event.key==='Home') { event.preventDefault(); setSplit(28); }
      if (event.key==='End') { event.preventDefault(); setSplit(72); }
    }, {signal:lifecycle.signal});
  }
  function bindEvents() {
    // The pointer marks the stage name it is over, the way a segmented
    // control lights the item under the cursor. The mark is a separate
    // element, so the label itself never shifts.
    document.addEventListener('pointerover',event=>{
      const pill=event.target.closest?.('.stage-pill');
      if(!pill)return;
      if(event.pointerType==='touch')return;
      updateNavHover(pill);
    },{signal:lifecycle.signal});
    document.addEventListener('pointerout',event=>{
      const pill=event.target.closest?.('.stage-pill');
      if(!pill)return;
      const to=event.relatedTarget;
      if(to&&pill.contains(to))return;
      const hover=$('.nav-hover');
      if(hover&&window.gsap)gsap.to(hover,{autoAlpha:0,duration:.2,ease:EASE.out,overwrite:true});
    },{signal:lifecycle.signal});
    // The bar grows a hairline once there is work behind it, so the top of
    // the screen reads as a bar over content rather than a floating strip.
    // The context row contracts at the same time and shows the name of the
    // stage, the way a large title collapses into a compact one.
    const workspace=$('#workspace');
    const contextRow=$('.workspace-context');
    const onScroll=()=>{
      const bar=$('.navbar');
      if(!bar||!workspace)return;
      const y=workspace.scrollTop;
      bar.classList.toggle('is-scrolled',y>4);
      if(contextRow) contextRow.classList.toggle('is-collapsed',y>40);
    };
    workspace?.addEventListener('scroll',onScroll,{signal:lifecycle.signal,passive:true});
    onScroll();
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-action],[data-stage],[data-stop-job]');if(!button||button.disabled)return;
      if(button.dataset.stopJob){event.preventDefault();event.stopPropagation();jobs.get(button.dataset.stopJob)?.abort();return;}
      // Every control gives a little under the hand before it acts.
      if(button.dataset.action && button.dataset.action!=='close-dialog') motion.press(button);
      if(button.dataset.stage){switchStage(button.dataset.stage,{focus:true});return;}
      const handler=actions[button.dataset.action];if(handler)handler(button);
    },{signal:lifecycle.signal});
    document.addEventListener('submit',event=>{if(event.target.id==='chatForm'){event.preventDefault();sendChat(event.target);}if(event.target.id==='sourceForm'){event.preventDefault();saveSource(event.target);}},{signal:lifecycle.signal});
    document.addEventListener('input',event=>{if(event.target.id==='commandInput')renderCommands(event.target.value);},{signal:lifecycle.signal});
    $('#logFilter').addEventListener('change',event=>{state.logFilter=event.target.value;renderLogs(true);},{signal:lifecycle.signal});
    document.addEventListener('keydown',event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();showCommands();return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='p'){event.preventDefault();state.pushed?hidePushedView():openPrototypeView();return;}
      if(event.key==='Escape'&&state.demo){stopDemo();return;}
      // Esc aborts the one running job when there is nothing to close first.
      if(event.key==='Escape'&&!$('#appDialog').open&&!state.demo&&jobs.size===1){
        const [name]=jobs.keys();jobs.get(name)?.abort();return;
      }
      const target=event.target instanceof Element?event.target:null;
      if(target?.id==='chatInput'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#chatForm').requestSubmit();return;}
      if(target?.closest('.dialog-tabs')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
        event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(state.contractTab+(event.key==='ArrowRight'?1:2))%3;showContract(next);return;
      }
      if(dialogKind==='commands'&&$('#appDialog').open){
        const items=$$('.command-item');
        if(!items.length)return;
        const index=items.indexOf(document.activeElement);
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();
          // With nothing focused the index is -1, so the ends are computed
          // explicitly instead of running the arithmetic off a negative base.
          const next = index<0
            ? (event.key==='ArrowDown'?0:items.length-1)
            : (index+(event.key==='ArrowDown'?1:items.length-1))%items.length;
          items[next]?.focus();return;
        }
        if(target?.id==='commandInput'&&event.key==='Enter'){event.preventDefault();items[0]?.click();return;}
      }
      // Alt+1…5 also accepts Digit1..Digit5, because Option+1 on macOS produces a
      // different character than the digit.
      const stageKey = /^[1-5]$/.test(event.key) ? event.key : (/^Digit[1-5]$/.test(event.code)?event.code.slice(-1):null);
      const typing=target?.closest('input,textarea,select,[contenteditable="true"]');
      if(!typing&&!$('#appDialog').open&&event.altKey&&stageKey){event.preventDefault();switchStage(stageKey);}
      // The panels and the log page have keys of their own, so the whole
      // layout can be driven without the mouse.
      if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&event.key==='\\'){event.preventDefault();togglePanel('left');return;}
      if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='l'){event.preventDefault();togglePanel('right');return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='j'){event.preventDefault();state.view==='logs'?leaveLogView():openLogView();return;}
      // Esc backs out of the log page, the same way it backs out of a dialog.
      if(event.key==='Escape'&&state.view==='logs'&&!$('#appDialog').open){event.preventDefault();leaveLogView();return;}
      // Esc backs out of the pushed prototype view too.
      if(event.key==='Escape'&&state.pushed&&!$('#appDialog').open){event.preventDefault();hidePushedView();return;}
    },{signal:lifecycle.signal});
    $('#appDialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();},{signal:lifecycle.signal});
    $('#appDialog').addEventListener('close',()=>{dialogKind='';if(dialogFocus?.isConnected&&dialogFocus.getClientRects().length)dialogFocus.focus();else $('.stage-pill.active')?.focus();},{signal:lifecycle.signal});
    window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(updateIndicator);},{signal:lifecycle.signal});
    reducedQuery.addEventListener('change',()=>{stageTimeline?.progress(1).kill();setupMotion();},{signal:lifecycle.signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.demo)stopDemo();},{signal:lifecycle.signal});
    window.addEventListener('pagehide',()=>{
      stopDemo();
      for(const controller of jobs.values())controller.abort();
      // The page may be frozen for bfcache before runJob's finally can run, so
      // a running button is restored here too: otherwise it comes back
      // permanently disabled.
      $$('[aria-busy="true"]').forEach(el=>{el.disabled=false;el.removeAttribute('aria-busy');el.classList.remove('is-running');});
      $('.job-stop')?.remove();
      stageTimeline?.progress(1).kill();
      animationContext?.revert();
      cancelAnimationFrame(resizeFrame);
    },{signal:lifecycle.signal});
  }
  function init(){render();applyTheme();applyPanels();bindEvents();bindSheetDrag();bindStageSwipe();bindReqSplit();switchStage(state.currentStage,{initial:true});refreshApproval();addLog('info','工作台就绪 / 本地演示会话');addLog('info','已加载采购系统与发票核验示例资产');addLog('warning','扫描、制造、质检为模拟；外部服务尚未接入');setupMotion();requestAnimationFrame(updateIndicator);}  init();
})();
