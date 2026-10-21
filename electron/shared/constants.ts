/**
 * 跨模块共享的业务常量。
 */

/**
 * 「置顶」分组在 ai_conversation.categoryId 里的取值。
 *
 * 置顶曾经用 pinned 字段表达，后来改成「置顶是一个特殊分组」，
 * 两套表示并存导致同一会话既不在置顶组也不在默认组（从侧边栏消失）。
 * 现在 categoryId 是唯一判据，pinned 字段退化为它的冗余副本：
 * 只用于排序（ORDER BY pinned DESC）和展示，由 updateSessionCategory 同步维护。
 */
export const PINNED_CATEGORY_ID = '__pinned__'
