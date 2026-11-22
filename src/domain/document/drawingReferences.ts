import type { DrawingObjects } from './types'

export function moveDrawingLabels<T extends DrawingObjects>(objects: T, owner: string, dx: number, dy: number): T {
  if (!objects.labels?.some(label => label.owner === owner)) return objects
  return { ...objects, labels: objects.labels.map(label => label.owner === owner
    ? { ...label, point: { x: label.point.x + dx, y: label.point.y + dy } } : label) }
}

export function removeDrawingReferences<T extends DrawingObjects>(objects: T, ids: ReadonlySet<string>): T {
  let result = objects
  if (objects.labels?.some(label => label.owner && ids.has(label.owner))) {
    result = { ...result, labels: objects.labels.filter(label => !label.owner || !ids.has(label.owner)) }
  }
  if (objects.groups?.some(group => group.members.some(id => ids.has(id)))) {
    result = { ...result, groups: objects.groups.map(group => group.members.some(id => ids.has(id))
      ? { ...group, members: group.members.filter(id => !ids.has(id)) } : group) }
  }
  return result
}
