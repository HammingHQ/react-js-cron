import React, { useCallback, useMemo, useRef, useState } from 'react'

import { formatValue, parsePartArray, partToString } from '../converter'
import { DEFAULT_LOCALE_EN } from '../locale'
import { Clicks, CronOption, CronType, LeadingZeroType, Unit, DefaultLocale } from '../types'
import { classNames, sort } from '../utils'

interface CustomSelectProps {
  value?: number[];
  grid?: boolean;
  optionsList?: CronOption[];
  setValue: (value: number[]) => void;
  locale: DefaultLocale;
  className?: string;
  humanizeLabels?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  leadingZero?: boolean | LeadingZeroType[];
  clockFormat?: '12-hour-clock' | '24-hour-clock';
  period?: string;
  unit: Unit;
  periodicityOnDoubleClick?: boolean;
  mode?: 'single' | 'multiple';
  allowClear?: boolean;
  filterOption?: (option: CronOption) => boolean;
}

export default function CustomSelect(props: CustomSelectProps) {
  const {
    value,
    grid = true,
    optionsList,
    setValue,
    locale,
    className,
    humanizeLabels,
    disabled,
    readOnly,
    leadingZero,
    clockFormat,
    period,
    unit,
    periodicityOnDoubleClick,
    mode,
    allowClear,
    filterOption = () => true,
  } = props

  const [isOpen, setIsOpen] = useState(false)

  const shouldAddLeadingZero = useCallback(
    (type: CronType): boolean => {
      const isLeadingZeroType = (t: CronType): boolean =>
        t === 'month-days' || t === 'hours' || t === 'minutes'

      return (
        (isLeadingZeroType(type) && leadingZero === true) ||
        (Array.isArray(leadingZero) &&
          isLeadingZeroType(type) &&
          leadingZero.includes(type as LeadingZeroType)) ||
        (clockFormat === '24-hour-clock' && (type === 'hours' || type === 'minutes'))
      )
    },
    [leadingZero, clockFormat]
  )

  const stringValue = useMemo(() => {
    if (!value || value.length === 0) {
      return ''
    }

    // Sort values
    const sortedValues = [...value].sort((a, b) => a - b)

    // Check if it's a range with step
    if (sortedValues.length >= 2) {
      const diff = sortedValues[1] - sortedValues[0]
      const isSequential = sortedValues.every((v, i) =>
        i === 0 || v === sortedValues[i - 1] + diff
      )
      if (isSequential && diff > 1) {
        const formattedStart = formatValue(sortedValues[0], unit)
        const formattedEnd = formatValue(sortedValues[sortedValues.length - 1], unit)
        return `${formattedStart}-${formattedEnd}/${diff}`
      }
    }

    // Check if it's a periodic value
    if (sortedValues.length === 1 && sortedValues[0] > 1) {
      return `every ${formatValue(sortedValues[0], unit)}`
    }

    // Default to comma-separated list
    return sortedValues.map(v => formatValue(v, unit)).join(',')
  }, [value, unit, humanizeLabels, optionsList, formatValue, clockFormat, leadingZero])

  const options = useMemo<CronOption[]>(() => {
    const generateNumericOptions = (): CronOption[] => {
      const result: CronOption[] = []

      // Add individual values first
      for (let i = unit.min; i <= unit.max; i++) {
        let label = i.toString()

        // Handle humanized labels for week days and months
        if (humanizeLabels && locale) {
          if (unit.type === 'week-days') {
            // Special handling for Sunday (0/7)
            const weekDayIndex = i === 7 ? 0 : i
            label = locale.weekDays?.[weekDayIndex] || label
          } else if (unit.type === 'months') {
            // Months are 1-indexed
            label = locale.months?.[i - 1] || label
          } else if (unit.type === 'hours' && clockFormat === '12-hour-clock') {
            const hour = i === 0 ? 12 : i > 12 ? i - 12 : i
            const ampm = i >= 12 ? 'PM' : 'AM'
            label = `${hour}${ampm}`
          } else if (shouldAddLeadingZero(unit.type) && i < 10) {
            label = `0${i}`
          }
        }

        result.push({
          value: i.toString(),
          label,
          'data-testid': `option-${unit.type}-${i}`
        })
      }

      // Add periodic values for supported types
      if (['minutes', 'hours'].includes(unit.type)) {
        for (let i = 2; i <= Math.min(30, unit.max); i++) {
          let label = i.toString()
          if (unit.type === 'hours' && clockFormat === '12-hour-clock') {
            const hour = i === 0 ? 12 : i > 12 ? i - 12 : i
            const ampm = i >= 12 ? 'PM' : 'AM'
            label = `${hour}${ampm}`
          } else if (shouldAddLeadingZero(unit.type) && i < 10) {
            label = `0${i}`
          }

          result.push({
            value: `*/${i}`,
            label: `every ${label}`,
            'data-testid': `option-${unit.type}-every-${i}`,
            isPeriodicValue: true
          })
        }
      }

      return result.filter(opt => !opt.hidden && filterOption(opt))
    }

    return generateNumericOptions()
  }, [unit, locale.weekDays, locale.months, humanizeLabels, shouldAddLeadingZero, periodicityOnDoubleClick, filterOption])

  const renderTag = useCallback(
    (itemValue: string) => {
      if (!itemValue) return null

      let cronValue = itemValue
      let label = itemValue

      // Handle periodic values
      if (itemValue.startsWith('*/')) {
        const interval = itemValue.replace('*/', '')
        return `every ${interval}`
      }

      // Handle regular values
      const numValue = Number(itemValue)
      if (humanizeLabels) {
        if (unit.type === 'hours' && clockFormat === '12-hour-clock') {
          const hour = numValue === 0 ? 12 : numValue > 12 ? numValue - 12 : numValue
          const ampm = numValue >= 12 ? 'PM' : 'AM'
          return leadingZero && hour < 10 ? `0${hour}${ampm}` : `${hour}${ampm}`
        } else if (
          (unit.type === 'hours' || unit.type === 'minutes' || unit.type === 'month-days') &&
          leadingZero &&
          numValue < 10
        ) {
          return `0${numValue}`
        } else if (unit.type === 'week-days' && locale?.weekDays) {
          const dayIndex = numValue === 7 ? 0 : numValue
          return locale.weekDays[dayIndex] || ''
        } else if (unit.type === 'months' && locale?.months) {
          return locale.months[numValue - 1] || ''
        }
      }

      return itemValue
    },
    [unit, locale, humanizeLabels, leadingZero, clockFormat]
  )

  const simpleClick = useCallback(
    (value: string) => {
      const numericValue = Number(value.replace(/^\*\//, ''))
      if (isNaN(numericValue)) {
        return
      }

      if (mode === 'single') {
        setValue([numericValue])
      } else {
        const newValue = [...(Array.isArray(stringValue) ? stringValue : [])]
        const index = newValue.indexOf(numericValue)

        if (index === -1) {
          newValue.push(numericValue)
          setValue(newValue)
        }
      }
    },
    [mode, setValue, stringValue]
  )

  const doubleClick = useCallback(
    (value: string) => {
      if (disabled || readOnly || !periodicityOnDoubleClick) {
        return
      }

      const numericValue = Number(value)
      if (isNaN(numericValue)) {
        return
      }

      // Set periodic value with string format
      setValue([`*/${numericValue}`] as (number | string)[])

      // Clear clicks after handling double click
      clicksRef.current = []
    },
    [disabled, readOnly, periodicityOnDoubleClick, setValue]
  )

  const clicksRef = useRef<Clicks[]>([])
  const onOptionClick = useCallback(
    (value: string) => {
      if (disabled || readOnly) {
        return
      }

      const now = Date.now()
      const clicks = clicksRef.current
      const lastClick = clicks[clicks.length - 1]

      if (lastClick && lastClick.value === value && now - lastClick.timestamp < 300) {
        // Double click detected
        doubleClick(value)
        clicksRef.current = []
      } else {
        // Single click handling
        const numericValue = Number(value.replace(/^\*\//, ''))
        if (isNaN(numericValue)) {
          return
        }

        if (mode === 'single') {
          setValue([numericValue])
        } else {
          const newValue = [...(Array.isArray(stringValue) ? stringValue : [])]
          const index = newValue.indexOf(numericValue)

          if (index === -1) {
            newValue.push(numericValue)
            setValue(newValue)
          } else {
            newValue.splice(index, 1)
            setValue(newValue)
          }
        }

        clicksRef.current = [
          ...clicks,
          {
            value,
            timestamp: now,
          },
        ]
      }
    },
    [disabled, readOnly, doubleClick, mode, setValue, stringValue]
  )

  const onClear = useCallback(() => {
    if (!readOnly) {
      setValue([])
    }
  }, [setValue, readOnly])

  const dropdownPosition = useMemo(() => {
    if (
      (unit.type === 'minutes' || unit.type === 'hours') &&
      period !== 'day' &&
      period !== 'hour'
    ) {
      return 'right-0'
    }
    return 'left-0'
  }, [unit.type, period])

  const dropdownWidth = useMemo(() => {
    if (unit.type === 'minutes') {
      if (period !== 'hour' && period !== 'day') {
        return 'w-[300px]' // Large
      }
      return 'w-[220px]' // Medium
    }
    if (unit.type === 'hours' && clockFormat === '12-hour-clock') {
      return 'w-[260px]'
    }
    return 'w-[174px]' // Default
  }, [unit.type, period, clockFormat])

  const gridColumns = useMemo(() => {
    if (unit.type === 'minutes') {
      if (period !== 'hour' && period !== 'day') {
        return 'grid-cols-6'
      }
      return 'grid-cols-5'
    }
    return 'grid-cols-4'
  }, [unit.type, period])

  return (
    <div
      className='relative inline-block min-w-[70px]'
      data-testid={`custom-select-${unit.type}`}
    >
      <button
        onClick={() => !readOnly && setIsOpen(!isOpen)}
        disabled={disabled}
        className={classNames(
          'w-full px-3 py-2 text-left border rounded-md bg-white',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-blue-500',
          className
        )}
      >
        <div className="text-sm">
          {(() => {
            if (!value || (Array.isArray(value) && value.length === 0)) {
              return (
                <div className="text-gray-400">
                  {unit.type === 'hours' ? locale.emptyHours || DEFAULT_LOCALE_EN.emptyHours :
                   unit.type === 'minutes' ? locale.emptyMinutes || DEFAULT_LOCALE_EN.emptyMinutes :
                   unit.type === 'month-days' ? locale.emptyMonthDays || DEFAULT_LOCALE_EN.emptyMonthDays :
                   unit.type === 'week-days' ? locale.emptyWeekDays || DEFAULT_LOCALE_EN.emptyWeekDays :
                   unit.type === 'months' ? locale.emptyMonths || DEFAULT_LOCALE_EN.emptyMonths :
                   locale.selectText || DEFAULT_LOCALE_EN.selectText}
                </div>
              )
            }

            const formatValue = (val: number, unit: Unit): string => {
              const isLeadingZeroType = (type: CronType): boolean =>
                type === 'month-days' || type === 'hours' || type === 'minutes'

              const shouldAddLeadingZero =
                (isLeadingZeroType(unit.type) && leadingZero === true) ||
                (Array.isArray(leadingZero) && isLeadingZeroType(unit.type) && leadingZero.includes(unit.type as LeadingZeroType)) ||
                (clockFormat === '24-hour-clock' && (unit.type === 'hours' || unit.type === 'minutes'))

              // Handle 12-hour clock format for hours
              if (unit.type === 'hours' && clockFormat === '12-hour-clock') {
                const hour = val === 0 ? 12 : val > 12 ? val - 12 : val
                const ampm = val >= 12 ? 'PM' : 'AM'
                return shouldAddLeadingZero ? `0${hour}${ampm}`.slice(-6) : `${hour}${ampm}`
              }

              // Handle numeric values with leading zeros
              const numericValue = shouldAddLeadingZero && val < 10 ? `0${val}` : val.toString()

              // Handle humanized labels for week days and months using locale arrays
              if (humanizeLabels && locale) {
                if (unit.type === 'week-days') {
                  const weekDayValue = val === 7 ? 0 : val
                  return locale.altWeekDays[weekDayValue]
                }
                if (unit.type === 'months') {
                  // Months are 1-indexed in the cron expression
                  return locale.altMonths[val - 1]
                }
              }

              return numericValue
            }

            if (typeof value === 'number') {
              return formatValue(value, unit)
            }

            if (value.length === 1) {
              const val = value[0]
              if (value && value.length === 1 && val > 1) {
                return `every ${formatValue(val, unit)}`
              }
              return formatValue(val, unit)
            }

            const sortedValues = [...value].sort((a, b) => a - b)

            const hasConsistentInterval = (values: number[]): { isValid: boolean; interval: number; start: number; end: number } => {
              if (values.length < 3) return { isValid: false, interval: 0, start: 0, end: 0 }
              const interval = values[1] - values[0]
              if (interval <= 1) return { isValid: false, interval: 0, start: 0, end: 0 }

              const start = values[0]
              const end = values[values.length - 1]
              const expected = []
              for (let i = start; i <= end; i += interval) {
                expected.push(i)
              }

              return {
                isValid: JSON.stringify(values) === JSON.stringify(expected),
                interval,
                start,
                end
              }
            }

            const { isValid: hasInterval, interval, start, end } = hasConsistentInterval(sortedValues)
            if (hasInterval) {
              if (unit.type === 'hours' && interval === 2) {
                return 'every 2'
              }
              if (unit.type === 'week-days' && interval === 2) {
                return 'every 2'
              }
              return `${formatValue(start, unit)}-${formatValue(end, unit)}/${interval}`
            }

            const ranges: number[][] = []
            let currentRange: number[] = [sortedValues[0]]

            for (let i = 1; i < sortedValues.length; i++) {
              if (sortedValues[i] === sortedValues[i - 1] + 1) {
                currentRange.push(sortedValues[i])
              } else {
                if (currentRange.length > 1) {
                  ranges.push([...currentRange])
                } else {
                  ranges.push([currentRange[0]])
                }
                currentRange = [sortedValues[i]]
              }
            }
            ranges.push(currentRange)

            const parts = ranges.map(range => {
              if (range.length === 1) {
                return formatValue(range[0], unit)
              }
              return `${formatValue(range[0], unit)}-${formatValue(range[range.length - 1], unit)}`
            })

            return parts.join(',')
          })()}
        </div>
      </button>

      {allowClear && !readOnly && value && value.length > 0 && (
        <button
          onClick={onClear}
          className='absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
        >
          ×
        </button>
      )}

      {isOpen && !readOnly && !disabled && (
        <div
          className={classNames(
            'absolute z-50 mt-1 py-1 bg-white border rounded-md shadow-lg',
            dropdownPosition,
            dropdownWidth
          )}
        >
          <div
            className={classNames(
              'max-h-60 overflow-auto',
              grid ? `grid ${gridColumns} gap-1` : ''
            )}
          >
            {options
              .filter(option => !option.hidden) // Filter out hidden options before rendering
              .map((option) => (
                <button
                  key={option.value}
                  onClick={() => onOptionClick(option.value)}
                  className={classNames(
                    'px-4 py-2 text-sm text-left hover:bg-blue-50',
                    value?.includes(Number(option.value)) ? 'bg-blue-100' : '',
                    grid ? 'text-center' : ''
                  )}
                >
                  {option.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
