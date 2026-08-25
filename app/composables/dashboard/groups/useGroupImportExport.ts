import { ref, type Ref } from 'vue'
import { stockGroupsExportFileSchema } from '~~/shared/schemas/stock-config'
import type { StockGroupsExportFile } from '~~/shared/types/stock'

/** useGroupImportExport 需要的页面状态和反馈回调。 */
interface GroupImportExportOptions {
  /** 当前页面选择的分组 ID，导入成功后重置为“全部”。 */
  selectedGroupId: Ref<string>
  /** 向页面展示操作结果。 */
  notify: (message: string) => void
}

/**
 * 负责用户分组配置文件的导入和导出：
 * 1. 按共享 Schema 生成和校验版本化 JSON 文件；
 * 2. 管理导入预览与二次确认状态；
 * 3. 导入确认后通过 Store 整体替换分组配置；
 * 4. 提供导入时间的本地化展示格式。
 */
export function useGroupImportExport(options: GroupImportExportOptions) {
  /** 用户配置 Store，提供分组读取和整份导入替换能力。 */
  const userConfigStore = useUserConfigStore()

  /** 已通过 Schema 校验、等待用户确认的导入文件。 */
  const importedGroupsFile = ref<StockGroupsExportFile | null>(null)

  /** 导入分组二次确认弹框是否打开。 */
  const importGroupsConfirmOpen = ref(false)

  /** 将当前所有持久化分组导出为版本化 JSON 文件。 */
  function exportGroups() {
    const payload: StockGroupsExportFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      groups: userConfigStore.stockGroups.map(group => ({
        name: group.name,
        isDefault: group.isDefault,
        members: group.members.map(({ addedAt: _addedAt, ...member }) => member)
      }))
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `value-ticker-groups-${formatExportDate(new Date())}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(link.href)
    options.notify(`已导出 ${payload.groups.length} 个分组`)
  }

  /** 读取并校验用户选择的 JSON 文件，成功后打开导入确认弹框。 */
  async function prepareGroupImport(file: File) {
    try {
      const parsed = stockGroupsExportFileSchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success) {
        options.notify(parsed.error.issues[0]?.message ?? '导入文件格式不合法')
        return
      }
      importedGroupsFile.value = parsed.data
      importGroupsConfirmOpen.value = true
    } catch {
      options.notify('无法读取 JSON 导入文件')
    }
  }

  /** 在没有保存请求时关闭导入确认弹框并清理待导入文件。 */
  function closeGroupImportConfirm() {
    if (userConfigStore.saving) return
    importGroupsConfirmOpen.value = false
    importedGroupsFile.value = null
  }

  /** 使用已确认的文件整体替换当前用户分组配置。 */
  async function importGroups() {
    const payload = importedGroupsFile.value
    if (!payload) return

    try {
      await userConfigStore.replaceGroups(payload)
      options.selectedGroupId.value = 'all'
      closeGroupImportConfirm()
      options.notify(`已导入 ${payload.groups.length} 个分组`)
    } catch (error) {
      console.error('[ValueTicker] 导入分组失败', error)
      options.notify(userConfigStore.errorMessage || '导入分组失败')
    }
  }

  /** 将导出时间格式化为中文本地时间供确认弹框展示。 */
  function formatImportedAt(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
  }

  /** 将当前日期格式化为导出文件名使用的 YYYYMMDD。 */
  function formatExportDate(value: Date) {
    const pad = (part: number) => String(part).padStart(2, '0')
    return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}`
  }

  return {
    importedGroupsFile,
    importGroupsConfirmOpen,
    exportGroups,
    prepareGroupImport,
    closeGroupImportConfirm,
    importGroups,
    formatImportedAt
  }
}
