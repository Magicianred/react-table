import { RowModel } from '..'
import { BuiltInAggregationFn, aggregationFns } from '../aggregationFns'
import {
  Cell,
  Column,
  OnChangeFn,
  TableInstance,
  Row,
  Updater,
  Renderable,
  TableGenerics,
  TableFeature,
} from '../types'
import { isFunction, makeStateUpdater, Overwrite } from '../utils'

export type GroupingState = string[]

export type AggregationFn<TGenerics extends TableGenerics> = (
  getLeafValues: () => TGenerics['Row'][],
  getChildValues: () => TGenerics['Row'][]
) => any

export type CustomAggregationFns<TGenerics extends TableGenerics> = Record<
  string,
  AggregationFn<TGenerics>
>

export type AggregationFnOption<TGenerics extends TableGenerics> =
  | 'auto'
  | BuiltInAggregationFn
  | keyof TGenerics['AggregationFns']
  | AggregationFn<TGenerics>

export type GroupingTableState = {
  grouping: GroupingState
}

export type GroupingColumnDef<TGenerics extends TableGenerics> = {
  aggregationFn?: AggregationFnOption<Overwrite<TGenerics, { Value: any }>>
  aggregateValue?: (columnValue: unknown) => any
  aggregatedCell?: Renderable<
    TGenerics,
    {
      instance: TableInstance<TGenerics>
      row: Row<TGenerics>
      column: Column<TGenerics>
      cell: Cell<TGenerics>
      getValue: () => TGenerics['Value']
    }
  >
  enableGrouping?: boolean
}

export type GroupingColumn<TGenerics extends TableGenerics> = {
  aggregationFn?: AggregationFnOption<Overwrite<TGenerics, { Value: any }>>
  getCanGroup: () => boolean
  getIsGrouped: () => boolean
  getGroupedIndex: () => number
  toggleGrouping: () => void
  getToggleGroupingHandler: () => () => void
  getColumnAutoAggregationFn: () => AggregationFn<TGenerics> | undefined
  getColumnAggregationFn: () => AggregationFn<TGenerics> | undefined
}

export type GroupingRow = {
  groupingColumnId?: string
  groupingValue?: any
  getIsGrouped: () => boolean
  groupingValuesCache: Record<string, any>
}

export type GroupingCell<TGenerics extends TableGenerics> = {
  getIsGrouped: () => boolean
  getIsPlaceholder: () => boolean
  getIsAggregated: () => boolean
  renderAggregatedCell: () => string | null | TGenerics['Rendered']
}

export type ColumnDefaultOptions = {
  // Column
  onGroupingChange: OnChangeFn<GroupingState>
  enableGrouping: boolean
}

export type GroupingOptions<TGenerics extends TableGenerics> = {
  manualGrouping?: boolean
  aggregationFns?: TGenerics['AggregationFns']
  onGroupingChange?: OnChangeFn<GroupingState>
  enableGrouping?: boolean
  enableGroupingRemoval?: boolean
  getGroupedRowModel?: (
    instance: TableInstance<TGenerics>
  ) => () => RowModel<TGenerics>

  groupedColumnMode?: false | 'reorder' | 'remove'
}

export type GroupingColumnMode = false | 'reorder' | 'remove'

export type GroupingInstance<TGenerics extends TableGenerics> = {
  setGrouping: (updater: Updater<GroupingState>) => void
  resetGrouping: () => void
  getPreGroupedRowModel: () => RowModel<TGenerics>
  getGroupedRowModel: () => RowModel<TGenerics>
  _getGroupedRowModel?: () => RowModel<TGenerics>
}

//

export const Grouping: TableFeature = {
  getDefaultColumn: <
    TGenerics extends TableGenerics
  >(): GroupingColumnDef<TGenerics> => {
    return {
      aggregationFn: 'auto',
    }
  },

  getInitialState: (state): GroupingTableState => {
    return {
      grouping: [],
      ...state,
    }
  },

  getDefaultOptions: <TGenerics extends TableGenerics>(
    instance: TableInstance<TGenerics>
  ): GroupingOptions<TGenerics> => {
    return {
      onGroupingChange: makeStateUpdater('grouping', instance),
      groupedColumnMode: 'reorder',
    }
  },

  createColumn: <TGenerics extends TableGenerics>(
    column: Column<TGenerics>,
    instance: TableInstance<TGenerics>
  ): GroupingColumn<TGenerics> => {
    return {
      toggleGrouping: () => {
        instance.setGrouping(old => {
          // Find any existing grouping for this column
          if (old?.includes(column.id)) {
            return old.filter(d => d !== column.id)
          }

          return [...(old ?? []), column.id]
        })
      },

      getCanGroup: () => {
        return (
          column.enableGrouping ??
          true ??
          instance.options.enableGrouping ??
          true ??
          !!column.accessorFn
        )
      },

      getIsGrouped: () => {
        return instance.getState().grouping?.includes(column.id)
      },

      getGroupedIndex: () => instance.getState().grouping?.indexOf(column.id),

      getToggleGroupingHandler: () => {
        const canGroup = column.getCanGroup()

        return () => {
          if (!canGroup) return
          column.toggleGrouping()
        }
      },
      getColumnAutoAggregationFn: () => {
        const firstRow = instance.getCoreRowModel().flatRows[0]

        const value = firstRow?.getValue(column.id)

        if (typeof value === 'number') {
          return aggregationFns.sum
        }

        if (Object.prototype.toString.call(value) === '[object Date]') {
          return aggregationFns.extent
        }

        return aggregationFns.count
      },
      getColumnAggregationFn: () => {
        const userAggregationFns = instance.options.aggregationFns

        if (!column) {
          throw new Error()
        }

        return isFunction(column.aggregationFn)
          ? column.aggregationFn
          : column.aggregationFn === 'auto'
          ? column.getColumnAutoAggregationFn()
          : (userAggregationFns as Record<string, any>)?.[
              column.aggregationFn as string
            ] ??
            (aggregationFns[
              column.aggregationFn as BuiltInAggregationFn
            ] as AggregationFn<TGenerics>)
      },
    }
  },

  createInstance: <TGenerics extends TableGenerics>(
    instance: TableInstance<TGenerics>
  ): GroupingInstance<TGenerics> => {
    return {
      setGrouping: updater => instance.options.onGroupingChange?.(updater),

      resetGrouping: () => {
        instance.setGrouping(instance.initialState?.grouping ?? [])
      },

      getPreGroupedRowModel: () => instance.getSortedRowModel(),
      getGroupedRowModel: () => {
        if (
          !instance._getGroupedRowModel &&
          instance.options.getGroupedRowModel
        ) {
          instance._getGroupedRowModel =
            instance.options.getGroupedRowModel(instance)
        }

        if (instance.options.manualGrouping || !instance._getGroupedRowModel) {
          return instance.getPreGroupedRowModel()
        }

        return instance._getGroupedRowModel()
      },
    }
  },

  createRow: <TGenerics extends TableGenerics>(
    row: Row<TGenerics>,
    instance: TableInstance<TGenerics>
  ): GroupingRow => {
    return {
      getIsGrouped: () => !!row.groupingColumnId,
      groupingValuesCache: {},
    }
  },

  createCell: <TGenerics extends TableGenerics>(
    cell: Cell<TGenerics>,
    column: Column<TGenerics>,
    row: Row<TGenerics>,
    instance: TableInstance<TGenerics>
  ): GroupingCell<TGenerics> => {
    return {
      getIsGrouped: () =>
        column.getIsGrouped() && column.id === row.groupingColumnId,
      getIsPlaceholder: () => !cell.getIsGrouped() && column.getIsGrouped(),
      getIsAggregated: () =>
        !cell.getIsGrouped() &&
        !cell.getIsPlaceholder() &&
        row.subRows?.length > 1,
      renderAggregatedCell: () => {
        const template = column.aggregatedCell ?? column.cell

        return template
          ? instance.render(template, {
              instance,
              column,
              row,
              cell,
              getValue: cell.getValue,
            })
          : null
      },
    }
  },
}

export function orderColumns<TGenerics extends TableGenerics>(
  leafColumns: Column<TGenerics>[],
  grouping: string[],
  groupedColumnMode?: GroupingColumnMode
) {
  if (!grouping?.length || !groupedColumnMode) {
    return leafColumns
  }

  const nonGroupingColumns = leafColumns.filter(
    col => !grouping.includes(col.id)
  )

  if (groupedColumnMode === 'remove') {
    return nonGroupingColumns
  }

  const groupingColumns = grouping
    .map(g => leafColumns.find(col => col.id === g)!)
    .filter(Boolean)

  return [...groupingColumns, ...nonGroupingColumns]
}
