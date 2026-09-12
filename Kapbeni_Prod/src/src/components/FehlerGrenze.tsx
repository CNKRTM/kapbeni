// ════════════════════════════════════════════════════════════════════════════
//  Fehlergrenze (Error Boundary).
//
//  React bricht beim Fehler im Rendern den GESAMTEN Baum ab — deshalb riss ein
//  einzelner kaputter Dashboard-Reiter die ganze Seite weiß, samt Navigation
//  und Fußzeile (siehe CLAUDE.md, "Favorilerim").
//
//  Diese Grenze fängt solche Fehler auf und zeigt an ihrer Stelle eine Meldung
//  im Seitendesign, während der Rest der Anwendung stehen bleibt.
//
//  Muss eine Klassenkomponente sein: componentDidCatch und
//  getDerivedStateFromError gibt es als Hook nicht.
// ════════════════════════════════════════════════════════════════════════════
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Wechselt dieser Wert, wird ein aufgefangener Fehler vergessen —
   *  sonst bliebe die Meldung auch nach einem Reiterwechsel stehen. */
  schluessel?: string | number
  /** Überschrift der Meldung; türkisch, wie die übrige Oberfläche. */
  titel?: string
}

interface State {
  fehler: Error | null
  schluessel?: string | number
}

/**
 * Hülle, die ihren Inhalt erst im EIGENEN Render auswertet.
 *
 * Notwendig, weil eine Fehlergrenze nur Fehler ihrer Nachfahren auffängt.
 * Steht der fehlerhafte Ausdruck direkt im JSX der Elternkomponente — etwa
 * `{liste.map(...)}` in Dashboard —, dann wirft er, während React die
 * Elternkomponente rendert. Die Grenze ist zu diesem Zeitpunkt noch gar nicht
 * an der Reihe und sieht nichts davon; die Seite bleibt weiß.
 *
 * Mit `<Inhalt render={() => …}>` wird der Ausdruck zu einem Kind-Render und
 * die Grenze greift. Der Komponententyp bleibt dabei stabil, es wird also
 * nichts bei jedem Durchlauf neu eingehängt.
 */
export function Inhalt({ render }: { render: () => ReactNode }) {
  return <>{render()}</>
}

export default class FehlerGrenze extends Component<Props, State> {
  state: State = { fehler: null, schluessel: undefined }

  static getDerivedStateFromError(fehler: Error): Partial<State> {
    return { fehler }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Reiterwechsel: der alte Fehler gehört nicht zum neuen Inhalt.
    if (props.schluessel !== state.schluessel) return { fehler: null, schluessel: props.schluessel }
    return null
  }

  componentDidCatch(fehler: Error, info: ErrorInfo) {
    // Sichtbar machen, statt still zu schlucken — sonst sucht man den Fehler
    // später vergeblich.
    console.error('[FehlerGrenze]', fehler.message, info.componentStack)
  }

  private erneut = () => this.setState({ fehler: null })

  render() {
    if (!this.state.fehler) return this.props.children

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <i className="ti ti-alert-triangle" style={{ fontSize: 22, color: '#dc2626' }} />
        </div>
        <h3 className="font-bold text-gray-900 text-sm mb-1">
          {this.props.titel || 'Bu bölüm yüklenemedi'}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed max-w-sm mx-auto mb-4">
          Beklenmeyen bir hata oluştu. Sayfanın geri kalanı çalışmaya devam ediyor.
        </p>
        <button
          onClick={this.erneut}
          className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
        >
          Tekrar Dene
        </button>
      </div>
    )
  }
}
