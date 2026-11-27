import { useState } from 'react'
import { useT, type GuideArtKey, type GuideEntry } from '../lib/i18n'
import { useKept } from '../lib/keep'
import { GuideArt } from './GuideArt'
import { ChevronDownIcon, LifebuoyIcon } from './icons'
import { SegThumb } from './Segmented'
import { Sheet } from './Sheet'

const TABS = ['charging', 'mazda'] as const
type Tab = (typeof TABS)[number]

/**
 * The help panel for the shared cars, in two tabs: how to charge one with the
 * company card, a card per step with its picture on top, and where the Mazda
 * 6e keeps the things a first-time EV driver looks for in the wrong place, a
 * grouped list whose titles say the gist and unfold for the rest. The words
 * live in `lib/i18n.ts` (`guide`, in both languages), one picture per entry in
 * `GuideArt.tsx`; edit those when the fleet or the chargers change, nothing
 * else needs to know. Its foot is the way to a person (`SupportSheet`) when a
 * step does not work.
 */
export function CarGuide({ onSupport, onClose }: { onSupport: () => void; onClose: () => void }) {
  const t = useT()
  const [tab, setTab] = useKept<Tab>('guide.tab', 'charging')
  const [open, setOpen] = useState<GuideArtKey | null>(null)
  return (
    <Sheet
      id="guide-title"
      title={t.guide.title}
      onClose={onClose}
      className="guide"
      footer={
        <button type="button" className="btn btn-soft btn-block guide-support" onClick={onSupport}>
          <LifebuoyIcon size={18} />
          <span>
            {t.support.stuck} <b>{t.support.title}</b>
          </span>
        </button>
      }
    >
      <div className="segmented guide-tabs" role="radiogroup" aria-label={t.guide.title}>
        <SegThumb count={TABS.length} index={TABS.indexOf(tab)} />
        {TABS.map((name) => (
          <button key={name} type="button" role="radio" aria-checked={tab === name} className={tab === name ? 'seg seg-on' : 'seg'} onClick={() => setTab(name)}>
            {name === 'charging' ? t.guide.chargingTab : t.guide.mazdaTab}
          </button>
        ))}
      </div>

      {tab === 'charging' ? (
        <ol className="guide-steps">
          {t.guide.charging.map((s: GuideEntry, i: number) => (
            <li key={s.art} className="card guide-step">
              <span className="guide-art" aria-hidden="true">
                <GuideArt art={s.art} width={240} />
              </span>
              <div className="guide-step-text">
                <span className="guide-step-no" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="group guide-list">
          {t.guide.mazda.map((q: GuideEntry) => {
            const shown = open === q.art
            return (
              <li key={q.art} className={shown ? 'guide-q howto-open' : 'guide-q'}>
                <button
                  type="button"
                  className="guide-q-head"
                  aria-expanded={shown}
                  aria-controls={`guide-${q.art}`}
                  onClick={() => setOpen(shown ? null : q.art)}
                >
                  <span className="guide-art guide-thumb" aria-hidden="true">
                    <GuideArt art={q.art} width={72} />
                  </span>
                  <span className="guide-q-title">{q.title}</span>
                  <ChevronDownIcon size={16} className="guide-q-chevron" />
                </button>
                <div id={`guide-${q.art}`} className="howto-body" inert={!shown}>
                  <div className="howto-clip">
                    <p className="guide-q-body">{q.body}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
