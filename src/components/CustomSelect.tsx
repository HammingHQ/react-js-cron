import React, { useCallback, useMemo, useRef, useState } from 'react'

import { formatValue, parsePartArray, partToString } from '../converter'
import { DEFAULT_LOCALE_EN } from '../locale'
import { Clicks, CustomSelectProps } from '../types'
import { classNames, sort } from '../utils'

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

  const stringValue = useMemo(() => {
    if (value && Array.isArray(value)) {
      return value.map((value: number) => value.toString())
    }
  }, [value])

  const options = useMemo(() => {
    if (optionsList) {
      return optionsList
        .map((option, index) => {
          const number = unit.min === 0 ? index : index + 1

          return {
            value: number.toString(),
            label: option,
          }
        })
        .filter(filterOption)
    }

    return [...Array(unit.total)]
      .map((e, index) => {
        const number = unit.min === 0 ? index : index + 1

        return {
          value: number.toString(),
          label: formatValue(
            number,
            unit,
            humanizeLabels,
            leadingZero,
            clockFormat
          ),
        }
      })
      .filter(filterOption)
  }, [
    optionsList,
    leadingZero,
    humanizeLabels,
    clockFormat,
    unit,
    filterOption,
  ])

  const renderTag = useCallback(
    (itemValue: string) => {
      if (!value || value[0] !== Number(itemValue)) {
        return null
      }

      const parsedArray = parsePartArray(value, unit)
      const cronValue = partToString(
        parsedArray,
        unit,
        humanizeLabels,
        leadingZero,
        clockFormat
      )
      const testEveryValue = cronValue.match(/^\*\/([0-9]+),?/) || []

      return testEveryValue[1]
        ? `${locale.everyText || DEFAULT_LOCALE_EN.everyText} ${
            testEveryValue[1]
          }`
        : cronValue
    },
    [value, unit, humanizeLabels, leadingZero, clockFormat, locale]
  )

  const simpleClick = useCallback(
    (newValueOption: number | number[]) => {
      const newValueOptions = Array.isArray(newValueOption)
        ? sort(newValueOption)
        : [newValueOption]
      let newValue: number[] = newValueOptions

      if (value) {
        newValue = mode === 'single' ? [] : [...value]

        newValueOptions.forEach((o) => {
          const newValueOptionNumber = Number(o)

          if (value.some((v) => v === newValueOptionNumber)) {
            newValue = newValue.filter((v) => v !== newValueOptionNumber)
          } else {
            newValue = sort([...newValue, newValueOptionNumber])
          }
        })
      }

      if (newValue.length === unit.total) {
        setValue([])
      } else {
        setValue(newValue)
      }
    },
    [setValue, value, mode, unit.total]
  )

  const doubleClick = useCallback(
    (newValueOption: number) => {
      if (newValueOption !== 0 && newValueOption !== 1) {
        const limit = unit.total + unit.min
        const newValue: number[] = []

        for (let i = unit.min; i < limit; i++) {
          if (i % newValueOption === 0) {
            newValue.push(i)
          }
        }
        const oldValueEqualNewValue =
          value &&
          newValue &&
          value.length === newValue.length &&
          value.every((v: number, i: number) => v === newValue[i])
        const allValuesSelected = newValue.length === options.length

        if (allValuesSelected) {
          setValue([])
        } else if (oldValueEqualNewValue) {
          setValue([])
        } else {
          setValue(newValue)
        }
      } else {
        setValue([])
      }
    },
    [value, options, setValue, unit.min, unit.total]
  )

  const clicksRef = useRef<Clicks[]>([])
  const onOptionClick = useCallback(
    (newValueOption: string) => {
      if (!readOnly) {
        const doubleClickTimeout = 300
        const clicks = clicksRef.current

        clicks.push({
          time: new Date().getTime(),
          value: Number(newValueOption),
        })

        const id = window.setTimeout(() => {
          if (
            periodicityOnDoubleClick &&
            clicks.length > 1 &&
            clicks[clicks.length - 1].time - clicks[clicks.length - 2].time <
              doubleClickTimeout
          ) {
            if (
              clicks[clicks.length - 1].value ===
              clicks[clicks.length - 2].value
            ) {
              doubleClick(Number(newValueOption))
            } else {
              simpleClick([
                clicks[clicks.length - 2].value,
                clicks[clicks.length - 1].value,
              ])
            }
          } else {
            simpleClick(Number(newValueOption))
          }

          clicksRef.current = []
        }, doubleClickTimeout)

        return () => {
          window.clearTimeout(id)
        }
      }
    },
    [clicksRef, simpleClick, doubleClick, readOnly, periodicityOnDoubleClick]
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
        {value && value.length > 0 ? (
          <div>{renderTag(stringValue?.[0] || '')}</div>
        ) : (
          <span className='text-gray-400'>Select...</span>
        )}
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
            {options.map((option) => (
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
