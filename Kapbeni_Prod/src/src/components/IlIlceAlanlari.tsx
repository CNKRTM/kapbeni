// ════════════════════════════════════════════════════════════════════════════
//  İl + İlçe als zwei Combobox-Felder (Daten aus /api/iller).
//
//  Liefert ZWEI Zellen ohne eigenen Rahmen — der Aufrufer legt das Raster fest
//  (meist grid-cols-2). Freie Eingabe bleibt erlaubt; wird ein İl aus der Liste
//  gewaehlt oder getippt, das die DB kennt, wird es auf deren Schreibweise
//  gebracht und das İlçe geleert, falls es nicht mehr passt.
// ════════════════════════════════════════════════════════════════════════════
import Combobox from './Combobox'
import { useIller, useIlceler, tuerkischGleich } from '../data/iller'

interface Props {
  il: string
  ilce: string
  onIl: (v: string) => void
  onIlce: (v: string) => void
  inputCls: string
  labelCls?: string
  ilLabel?: string
  ilceLabel?: string
  /** Fehlertext unter dem İl-Feld. */
  ilHata?: string
  inputStyle?: React.CSSProperties
  /** Ohne Beschriftung (z. B. im Filter, wo die Ueberschrift darueber steht). */
  ohneLabel?: boolean
}

export default function IlIlceAlanlari({
  il, ilce, onIl, onIlce, inputCls, labelCls = 'block text-xs font-bold text-gray-700 mb-1.5',
  ilLabel = 'İl', ilceLabel = 'İlçe', ilHata, inputStyle, ohneLabel,
}: Props) {
  const iller = useIller()
  const ilceler = useIlceler(il)

  const ilSetzen = (v: string) => {
    const bekannt = iller.find((x) => tuerkischGleich(x.ad, v))
    const neu = bekannt ? bekannt.ad : v
    if (!tuerkischGleich(neu, il)) onIlce('')
    onIl(neu)
  }

  return (
    <>
      <div>
        {!ohneLabel && <label className={labelCls}>{ilLabel}</label>}
        <Combobox
          value={il}
          onChange={(v) => {
            // Waehrend des Tippens nicht umschreiben, nur bei exaktem Treffer angleichen.
            const bekannt = iller.find((x) => tuerkischGleich(x.ad, v))
            if (bekannt && bekannt.ad !== il) ilSetzen(bekannt.ad)
            else { if (!tuerkischGleich(v, il)) onIlce(''); onIl(v) }
          }}
          onSecim={ilSetzen}
          secenekler={iller.map((x) => x.ad)}
          placeholder="İl seçin veya yazın"
          className={inputCls}
          style={inputStyle}
          ariaLabel={ilLabel}
        />
        {ilHata && <span className="text-red-500 text-xs mt-1 block">{ilHata}</span>}
      </div>
      <div>
        {!ohneLabel && <label className={labelCls}>{ilceLabel}</label>}
        <Combobox
          value={ilce}
          onChange={(v) => {
            const bekannt = ilceler.find((x) => tuerkischGleich(x, v))
            onIlce(bekannt || v)
          }}
          secenekler={ilceler}
          placeholder={il ? 'İlçe seçin veya yazın' : 'Önce il seçin'}
          className={inputCls}
          style={inputStyle}
          ariaLabel={ilceLabel}
        />
      </div>
    </>
  )
}
