/* eslint-disable no-nested-ternary */

import React, { useState, useEffect, useCallback } from 'react'
import { Stack, SpinButton, Slider, Label } from '@fluentui/react'
import useSWR from 'swr'
import { useSelector, useDispatch } from 'react-redux'

import { runCommand } from '@/utils/fetcher'
import { SystemProfileDoc } from '@/types'
import { actions } from '@/stores'
import { LargeMessage } from '@/components/LargeMessage'
import { SystemProfilePagination } from '@/components/SystemProfilePagination'
import { SystemProfileCard } from '@/components/SystemProfileCard'

export default () => {
  const { connection, database, collection } = useSelector(
    (state) => state.root,
  )
  const { filter, skip, limit } = useSelector((state) => state.docs)
  const { data: profile, revalidate } = useSWR(`profile/${connection}`, () =>
    runCommand<{ was: number; slowms: number; sampleRate: number }>(
      connection,
      'admin',
      {
        profile: -1,
      },
    ),
  )
  const [slowms, setSlowms] = useState(0)
  const dispatch = useDispatch()
  const [sampleRate, setSampleRate] = useState(0)
  useEffect(() => {
    if (!profile) {
      return
    }
    setSlowms(profile.slowms)
    setSampleRate(profile.sampleRate)
  }, [profile])
  const { data, error } = useSWR(
    database
      ? `systemProfile/${connection}/${database}/${JSON.stringify(
          filter,
        )}/${skip}/${limit}`
      : null,
    () =>
      runCommand<{
        cursor: { firstBatch: SystemProfileDoc[] }
      }>(connection, database!, {
        find: 'system.profile',
        sort: {
          ts: -1,
        },
        filter,
        skip,
        limit,
      }),
  )
  useEffect(() => {
    dispatch(
      actions.docs.setFilter(
        collection && collection !== 'system.profile'
          ? {
              ns: `${database}.${collection}`,
            }
          : {},
      ),
    )
  }, [database, collection])
  const [loading, setLoading] = useState(false)
  const handleSetProfile = useCallback(
    async (_slowms: number, _sampleRate: number) => {
      if (!database) {
        return
      }
      setLoading(true)
      try {
        await runCommand(connection, database, {
          profile: 1,
          slowms: _slowms,
          sampleRate: { $numberDouble: _sampleRate.toString() },
        })
      } finally {
        setLoading(false)
        revalidate()
      }
    },
    [database],
  )

  if (!database || !collection) {
    return <LargeMessage iconName="Back" title="Select Collection" />
  }
  return (
    <>
      <Stack
        horizontal={true}
        tokens={{ childrenGap: 10, padding: 10 }}
        styles={{ root: { height: 52, alignItems: 'center' } }}>
        <SpinButton
          disabled={loading}
          label="Slow Ms:"
          styles={{
            spinButtonWrapper: { width: 80 },
            label: { marginLeft: 10 },
            root: { width: 'fit-content', marginRight: 10 },
          }}
          value={slowms.toString()}
          step={10}
          onBlur={(ev) => {
            const _slowms = Math.max(parseInt(ev.target.value, 10), 0)
            setSlowms(_slowms)
            handleSetProfile(_slowms, sampleRate)
          }}
          onIncrement={(value) => {
            const _slowms = Math.max(parseInt(value, 10) + 10, 0)
            setSlowms(_slowms)
            handleSetProfile(_slowms, sampleRate)
          }}
          onDecrement={(value) => {
            const _slowms = Math.max(parseInt(value, 10) - 10, 0)
            setSlowms(_slowms)
            handleSetProfile(_slowms, sampleRate)
          }}
        />
        <Label disabled={loading}>Sample Rate:</Label>
        <Slider
          disabled={loading}
          styles={{
            slideBox: { width: 100 },
          }}
          min={0}
          max={1}
          step={0.01}
          valueFormat={(value) => `${Math.round(value * 100)}%`}
          value={sampleRate}
          onChange={setSampleRate}
          onChanged={(_ev, value) => {
            setSampleRate(value)
            handleSetProfile(slowms, value)
          }}
        />
        <Stack.Item grow={true}>
          <div />
        </Stack.Item>
        <SystemProfilePagination />
      </Stack>
      <Stack
        tokens={{ childrenGap: 20 }}
        styles={{
          root: {
            overflowY: 'scroll',
            padding: 20,
            flex: 1,
            margin: '0 auto',
            maxWidth: '100%',
          },
        }}>
        {error ? (
          <LargeMessage
            iconName="Error"
            title="Error"
            content={error.message}
          />
        ) : data ? (
          data.cursor.firstBatch.length ? (
            data.cursor.firstBatch.map((item, index) => (
              <SystemProfileCard
                key={`${item.ts}${index.toString()}`}
                value={item}
              />
            ))
          ) : (
            <LargeMessage iconName="Database" title="No Profile" />
          )
        ) : (
          <LargeMessage iconName="SearchData" title="Loading" />
        )}
      </Stack>
    </>
  )
}
