// Hinweisleiste fuer den Teststand. kapbeni.com ist seit 08.11.2026 Staging
// (Entscheidung Betreiber); Prod wird spaeter getrennt gebaut. Das Banner
// verschwindet nur in einem Bau mit KAPBENI_ORTAM=prod.
export default function StagingBanner() {
  if (__KAPBENI_ORTAM__ === 'prod') return null
  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-800 text-center text-xs font-semibold py-1.5 px-3">
      TEST SUNUCUSU (STAGING) · Burası canlı sistem değildir, ilanlar ve kullanıcılar test amaçlıdır.
    </div>
  )
}
