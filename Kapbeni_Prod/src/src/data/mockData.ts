import type { Listing } from '../api'

export interface AppChat {
  id: string
  listingId?: string
  listingTitle?: string
  listingPrice?: number
  listingImage?: string
  sellerName?: string
  messages?: Array<{
    id: string
    sender: 'user' | 'seller'
    text: string
    timestamp: string
  }>
  unread?: boolean
}

// ─────────────────────────────────────────────
// 9 ECHTE ANZEIGEN von kapbeni.com (Live-API)
// ─────────────────────────────────────────────
const REAL_LISTINGS: Listing[] = [
  {
    id: '88aca17b-d187-49c7-b948-62a3f947cc5d',
    title: 'Asus Notebook',
    price: 25000,
    category: '',
    location: 'Mersin',
    date: 'Yeni',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80',
    description: 'bilgisayar dokunmatik ekranlidir. i5 işlemci 4. nesil 4 çekirdekli 8 GB RAM 500 GB harddisk 2 GB Nvidia harici ekran kartı mevcuttur bazı oyunları oynatır. pili 2 saat civarı dayanır. çantası şarj aleti ile birlikte vereceğim kozmetik olarak sadece alt kısmındaki menteşe kapağı yoktur kullanıma hiçbir zarar olmaz.',
    sellerName: 'Burak Özarıkan',
    sellerPhone: '',
    isFavorite: false,
    condition: 'Sıfır Ayarında',
  },
  {
    id: '8a53ba8b-b1a3-4e3e-9f56-f68a6249c266',
    title: 'Gravel Bisiklet - Specialized Sequoia',
    price: 27500,
    category: 'spor',
    location: 'Bodrum, Muğla',
    date: 'Yeni',
    image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
    description: 'Specialized Sequoia Gravel macera bisikleti. Shimano Sora setli, çelik kadro ve karbon maşa. Uzun turlar ve bozuk yollar için harika kondisyondadır. Lastikler yeni tubeless yapılmıştır. Aksesuarlar dahil değildir.',
    sellerName: 'SattimGitti Demo',
    sellerPhone: '',
    isFavorite: false,
    condition: 'İkinci El',
  },
  {
    id: '7e737357-6470-4e33-83d0-c4579f099d5d',
    title: 'Vintage Deri Ceket - Klasik Kesim',
    price: 3200,
    category: 'giyim',
    location: 'Bornova, İzmir',
    date: 'Yeni',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
    description: 'L beden, orijinal kalın sığır derisi klasik kesim vintage ceket. İç astarı yırtıksız tertemizdir. Fermuarlar sapasağlam çalışıyor. Koleksiyonluk, tarz sahibi bir parça.',
    sellerName: 'SattimGitti Demo',
    sellerPhone: '',
    isFavorite: false,
    condition: 'İkinci El',
  },
  {
    id: '9fb5836c-f36e-47ab-b3e9-006b422cba1c',
    title: 'BMW 3 Serisi 320i M Sport 2021',
    price: 1850000,
    category: 'araba',
    location: 'Nilüfer, Bursa',
    date: 'Yeni',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
    description: 'BMW 320i Sedan M Sport Paket. Borusan çıkışlı ve bakımlı. Hayalet ekran, vakumlu kapılar, şerit takip, kör nokta ve otonom frenleme özellikleri mevcuttur. Değişensiz, sadece sağ çamurluk lokal boyalı.',
    sellerName: 'SattimGitti Demo',
    sellerPhone: '',
    isFavorite: false,
    condition: 'İkinci El',
  },
  {
    id: '44161d36-c102-4a37-b834-6cf34c8fe778',
    title: 'MacBook Pro M3 Max 36GB - 1TB SSD',
    price: 118000,
    category: 'elektronik',
    location: 'Beşiktaş, İstanbul',
    date: 'Yeni',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
    description: 'Apple Silicon M3 Max işlemci, 36GB birleşik bellek, 1TB SSD depolama. Uzay siyahı renginde. Sadece yazılım geliştirme için evde monitöre bağlı kullanıldı, çiziksizdir. Devir teslim faturasıyla yapılacaktır.',
    sellerName: 'SattimGitti Demo',
    sellerPhone: '',
    isFavorite: false,
    condition: 'Sıfır Ayarında',
  },
  {
    id: 'bce84c9f-5a8c-4aa1-904a-2aeba7d15afe',
    title: 'DJI Air 3 Fly More Combo Az Kullanılmış',
    price: 42000,
    category: 'spor',
    location: 'Muratpaşa, Antalya',
    date: 'Yeni',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKc6BYp_q0lXdeTGRpBe2Eq8APgrauPcGQQ8iDiqgvMCIgUUzurYu8O0TaRgRnkBCHQLwbpD0XxSeRmmw0enBFvrMozilG9_c76IxfMu3uqSOGbJyz6a8Hu1U4d35k0XQrKW4oJI-cZO0OI5--8H8g1TugCmj8wqc7QFw6PHQVTlrsSouJQuk1t7hZfNhdg1uHdZwlYYlwitOjZ-rXLVCx63t1DfgHOq3E8ZxT7bVCzpgvBJE_r2oqL3fOjjSnSflvBoRem5Xj6Uvt',
    description: 'Yedek pervaneleri, akıllı şarj istasyonu, 3 adet bataryası ve DJI RC-N2 kumandası ile tam set Fly More Combo. Sadece 4 kez uçuruldu, kaza veya kırım kesinlikle yaşanmadı. SHGM kayıtlıdır, devri hemen yapılacaktır.',
    sellerName: 'SattimGitti Demo',
    sellerPhone: '',
    isFavorite: false,
    condition: 'Az Kullanılmış',
  },
  {
    id: '1dc2bf17-41d4-4fa0-ab0a-7197c486d9eb',
    title: 'Modern Tasarım Deri Berjer - Çok Temiz',
    price: 12800,
    category: 'ev-yasam',
    location: 'Alsancak, İzmir',
    date: 'Yeni',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0wIK14j3uLrg3CWONLJdpJoSIWTteSWIqp2rvKg9eqSpEXdOjq1UejL4NkbfbY7yeG9_9IQJfDaja6WcCx-QxhC22gldD7Ed8NE0q2OzK8l2OpHrbUHe3W4sORqiCu982HKiEu0FBWMAiSh2dL2rdMCuegYJf1aVydDjvCsnm5K8nOzty8JvtV3ZoeNDqmekYdowSNcUBP3_Y-Lc8EMHiby9hq3l59e3bDrL9KLVr4Yn0ZO249WTKGtw2xuRzDlqdUtrE57TxrIpm',
    description: 'Özel tasarım, ceviz ahşap iskelet üzerine hakiki siyah deri kaplama modern berjer ve ayak uzatma pufu (ottoman). Salonumuzun dekorasyon değişikliği sebebiyle satıyoruz. Derisinde herhangi bir yırtık veya aşınma yoktur.',
    sellerName: 'SattimGitti Demo',
    sellerPhone: '',
    isFavorite: false,
    condition: 'İkinci El',
  },
  {
    id: 'c423e737-bf51-4b76-8fb8-ee8bda1dff9c',
    title: 'iPhone 15 Pro Max 256GB Sıfır Ayarında',
    price: 64500,
    category: 'elektronik',
    location: 'Çankaya, Ankara',
    date: 'Yeni',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkPHTLG-B5bOPVKJEk4MRZEaCZk9tmCK8N8yebkzrfvCpDwLUUU9NKJoMlea5_-OFRwt3QzG2qjqifju6BpBhGgaFl8VKNHY9bx1LZziKZtAVXCuhTc0oViD-7ubyIO5IeBS1_Dre8dcvhlP13kJDFDPaJsmVVjO_C5n6lWAQ7tbFQAquiHZC2ENZomt9mYsvgdRKqtUqAZe7lnHJ8WQzrlwWtdYPUp0BEOq4Ef0lZ28IIxcR3AURmCjI99wdZ6ppJY0jwb7FK0JHd',
    description: 'Kutulu, faturalı ve Apple Türkiye garantili iPhone 15 Pro Max Natural Titanium. Pil sağlığı %98 durumdadır. Herhangi bir çizik, darbe kesinlikle yoktur. İlk günden itibaren koruyucu cam ve orijinal kılıf ile kullanılmıştır.',
    sellerName: 'SattimGitti Demo',
    sellerPhone: '',
    isFavorite: false,
    condition: 'Sıfır Ayarında',
  },
  {
    id: 'a14eca42-4f4c-46f8-9e4a-352e60ed530d',
    title: 'Tesla Model Y Performance 2022',
    price: 2450000,
    category: 'araba',
    location: 'Kadıköy, İstanbul',
    date: 'Yeni',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZKr_N_fXhXOvasg2ewyi2xmqHIlaI8JX4zaOVu-sa8mtHh2RWw3N_A_tgHtJ8i-5K9fL6rbAWBtcCCItzYtLCXDPL37im4hzTVWd02uigXPMiaObHlzM27SQgniP-6S0MSF25x2XIv3k7gHNYUtGPOfdaUYfShTdOn2OnEct5H-5MWxFImJmNXR7V1x7ovnHP2F_M66YqPlMltSCvJnheZ_ZhXQLBKrax0e6wfqdpsN2TPrBkMaPlNmLi4lozJI_SHlCjF2WeuUiJ',
    description: 'Hatasız, boyasız, tramersiz Tesla Model Y Performance. Otopilot aktif, beyaz deri döşeme, cam tavan ve 21 inç Überturbine jantlar mevcuttur. Sadece kapalı garajda muhafaza edilmiştir. Takas düşünmüyorum.',
    sellerName: 'SattimGitti Demo',
    sellerPhone: '',
    isFavorite: false,
    condition: 'Sıfır Ayarında',
  },
]

// ─────────────────────────────────────────────
// Hilfsfunktionen & Mock-Daten
// ─────────────────────────────────────────────
const mw = [
  'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1593055357429-62b8b3d91e2a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1506015391300-4802dc574a3d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1558980664-769d59546b3d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1593359677879-a4bb92f4834c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1549187774-b4e9b0445b41?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80',
]

function se(n: number): string { return mw[n - 1] }

const pl = [
  'Ahmet Yılmaz', 'Merve Demir', 'Can Özkan', 'Serkan Güler', 'Yusuf Tekin',
  'Murat Şahin', 'Buse Kaya', 'Deniz Soydan', 'Hakan Arslan', 'Zeynep Çelik',
  'Emre Doğan', 'Selin Kara', 'Burak Aydın', 'Fatma Yıldız', 'Oğuz Erdoğan',
  'Gizem Polat', 'Mustafa Kurt', 'Ayşe Güneş', 'Tolga Aksoy', 'Elif Saraç',
]

const pi = [
  'Özgür Otomotiv A.Ş.', 'TeknoMarket Ltd.', 'Moda House Tekstil', 'SportZone TR',
  'EcoHome Mobilya', 'DigiShop Elektronik', 'AutoElite Galeri', 'FashionTR Butik',
  'GreenGarden A.Ş.', 'BookHub Yayınevi',
]

const LOCATIONS = [
  'İstanbul, Kadıköy', 'Ankara, Çankaya', 'İzmir, Alsancak', 'Antalya, Muratpaşa',
  'İstanbul, Beşiktaş', 'Bursa, Nilüfer', 'İzmir, Bornova', 'Muğla, Bodrum',
  'İstanbul, Şişli', 'Ankara, Keçiören', 'İzmir, Konak', 'Antalya, Kepez',
  'İstanbul, Ümraniye', 'Kocaeli, İzmit', 'Eskişehir, Tepebaşı',
]

const DATES = ['Bugün', '2 saat önce', '4 saat önce', 'Dün', '2 gün önce', '3 gün önce', '5 gün önce', '1 hafta önce']

function Qe(n: number): string | null {
  if (n % 20 === 0) return 'super'
  if (n % 7 === 0) return 'onecikan'
  return null
}

function pw(n: number): boolean { return n % 5 === 0 }

const RAW: Array<{
  id: number; title: string; price: number; category: string
  location: string; description: string; img: number; condition: string
}> = [
  { id: 1,  title: 'Volkswagen Golf 1.5 TSI Life 2022',       price: 1120000, category: 'Araba',       location: LOCATIONS[0],  description: 'Boyasız, hasarsız, özgün km ile 1.5 TSI otomatik vites Golf.',          img: 1,  condition: 'İkinci El' },
  { id: 2,  title: 'Renault Megane E-Tech Electric 2023',      price: 1380000, category: 'Araba',       location: LOCATIONS[4],  description: 'Tam elektrikli, 130 HP, hızlı şarj destekli sıfır km araç.',             img: 2,  condition: 'Sıfır Ayarında' },
  { id: 3,  title: 'Toyota Corolla 1.8 Hybrid Flame 2021',     price: 980000,  category: 'Araba',       location: LOCATIONS[1],  description: 'Hybrid sistemi mükemmel, yakıt tüketimi düşük, bakımlı Corolla.',        img: 3,  condition: 'İkinci El - Az Kullanılmış' },
  { id: 4,  title: 'Fiat Egea 1.6 Multijet Easy 2020',         price: 720000,  category: 'Araba',       location: LOCATIONS[7],  description: 'Dizel, ekonomik, iç mekan temiz Egea sedan.',                            img: 4,  condition: 'İkinci El' },
  { id: 5,  title: 'BMW 5 Serisi 520i M Sport 2022',           price: 2350000, category: 'Araba',       location: LOCATIONS[5],  description: 'BMW 520i M Sport, panoramik tavan, harman kardon ses sistemi.',          img: 5,  condition: 'İkinci El - Az Kullanılmış' },
  { id: 6,  title: 'Opel Astra 1.2T GS 2023',                 price: 890000,  category: 'Araba',       location: LOCATIONS[2],  description: 'Yeni nesil Astra, matris LED far, 130 HP turbo benzin.',                 img: 6,  condition: 'Sıfır Ayarında' },
  { id: 7,  title: 'Ford Focus 1.5 EcoBoost ST-Line 2021',     price: 875000,  category: 'Araba',       location: LOCATIONS[13], description: 'ST-Line paket, spor görünüm, adaptif cruise kontrol.',                   img: 7,  condition: 'İkinci El' },
  { id: 8,  title: 'Peugeot 3008 1.5 BlueHDi GT 2022',        price: 1450000, category: 'Araba',       location: LOCATIONS[9],  description: 'Dizel SUV, i-Cockpit sürücü kokpiti, tam donanım GT paketi.',            img: 8,  condition: 'İkinci El - Az Kullanılmış' },
  { id: 9,  title: 'Honda CB500F 2021',                        price: 165000,  category: 'Motosiklet',  location: LOCATIONS[3],  description: 'A2 kategorisi, ehliyete uygun, 47 HP, bakımları yapıldı.',               img: 9,  condition: 'İkinci El - Az Kullanılmış' },
  { id: 10, title: 'Yamaha MT-07 2022',                        price: 285000,  category: 'Motosiklet',  location: LOCATIONS[0],  description: '689cc çift silindir, 74 HP, hiper naked tasarım.',                      img: 10, condition: 'İkinci El - Az Kullanılmış' },
  { id: 11, title: 'Kawasaki Z900 2023',                       price: 420000,  category: 'Motosiklet',  location: LOCATIONS[2],  description: '948cc, 125 HP, agresif Sugomi tasarım, abs + traksiyon kontrolü.',      img: 11, condition: 'İkinci El - Çok Temiz' },
  { id: 12, title: 'Royal Enfield Meteor 350 2022',            price: 120000,  category: 'Motosiklet',  location: LOCATIONS[14], description: 'Cruiser tarzı, uzun yol konforu, bluetooth navigasyon sistemi.',         img: 12, condition: 'İkinci El' },
  { id: 13, title: 'Samsung Galaxy S24 Ultra 512GB',           price: 52000,   category: 'Elektronik',  location: LOCATIONS[1],  description: 'S Pen dahil, 200MP kamera, titanium çerçeve, sıfır ayarında.',          img: 13, condition: 'Sıfır Ayarında' },
  { id: 14, title: 'iPad Pro M2 12.9 inç 256GB WiFi',         price: 38500,   category: 'Elektronik',  location: LOCATIONS[4],  description: 'Liquid Retina XDR ekran, M2 çip, Space Grey, çizik yok.',               img: 14, condition: 'İkinci El - Çok Temiz' },
  { id: 15, title: 'OnePlus 12 512GB Siyah',                   price: 24500,   category: 'Elektronik',  location: LOCATIONS[6],  description: 'Snapdragon 8 Gen 3, 100W şarj, Hasselblad kamera sistemi.',             img: 15, condition: 'İkinci El - Az Kullanılmış' },
  { id: 16, title: 'PlayStation 5 Disc Edition',               price: 22500,   category: 'Elektronik',  location: LOCATIONS[0],  description: 'Kutulu, faturalı, 2 kol dahil, az oynanmış temiz konsol.',              img: 16, condition: 'İkinci El - Çok Temiz' },
  { id: 17, title: 'Sony WH-1000XM5 Kulaklık',                price: 11200,   category: 'Elektronik',  location: LOCATIONS[8],  description: 'Endüstrinin en iyi gürültü engelleme sistemi, 30 saat pil.',            img: 17, condition: 'İkinci El - Çok Temiz' },
  { id: 18, title: 'Canon EOS R6 Mark II',                     price: 65000,   category: 'Elektronik',  location: LOCATIONS[5],  description: '40fps çekim hızı, in-body stabilizasyon, 4K 60p video.',               img: 18, condition: 'İkinci El - Az Kullanılmış' },
  { id: 19, title: 'Dyson V15 Detect Absolute',                price: 15800,   category: 'Elektronik',  location: LOCATIONS[3],  description: 'Lazer toz tespiti, HEPA filtre, 60 dakika pil, tüm başlıklar dahil.', img: 19, condition: 'İkinci El - Az Kullanılmış' },
  { id: 20, title: 'MacBook Pro M3 Max 36GB - 1TB',           price: 118000,  category: 'Elektronik',  location: LOCATIONS[4],  description: 'Apple Silicon M3 Max, 36GB birleşik bellek, 1TB SSD, Space Black.',    img: 20, condition: 'Sıfır Ayarında' },
  { id: 21, title: 'Philips Hue Başlangıç Paketi',            price: 4200,    category: 'Elektronik',  location: LOCATIONS[9],  description: '4 akıllı ampul + bridge, sesli asistan uyumlu, renk değiştirme.',      img: 21, condition: 'İkinci El - Çok Temiz' },
  { id: 22, title: 'IKEA Kallax 4x4 Raf Ünitesi',             price: 3800,    category: 'Ev & Yaşam',  location: LOCATIONS[2],  description: 'Beyaz, 16 gözlü, çok sağlam yapı, sökülerek taşınabilir.',             img: 22, condition: 'İkinci El - Çok Temiz' },
  { id: 23, title: 'Kanepe Takımı 3+2+1 Köşeli',              price: 18500,   category: 'Ev & Yaşam',  location: LOCATIONS[0],  description: 'Gri kumaş, ahşap ayak, yıkanabilir kılıf, sağ köşe dönüşlü.',         img: 23, condition: 'İkinci El - Az Kullanılmış' },
  { id: 24, title: 'Kahve Köşesi Konsol Masa',                 price: 6200,    category: 'Ev & Yaşam',  location: LOCATIONS[13], description: 'Endüstriyel tasarım, metal ayak, meşe ahşap tabla, 2 çekmece.',       img: 24, condition: 'İkinci El - Çok Temiz' },
  { id: 25, title: 'Yemek Masası + 6 Sandalye Takımı',        price: 14000,   category: 'Ev & Yaşam',  location: LOCATIONS[6],  description: 'Ceviz kaplama masa, metal sandalye bacak, deri oturma yüzeyi.',       img: 25, condition: 'İkinci El' },
  { id: 26, title: 'Bosch Serie 8 Çamaşır Makinesi',          price: 12800,   category: 'Ev & Yaşam',  location: LOCATIONS[1],  description: '10 kg, 1600 devir, i-DOS otomatik deterjan dozlama sistemi.',         img: 26, condition: 'İkinci El - Az Kullanılmış' },
  { id: 27, title: 'Arçelik No-Frost Buzdolabı 650L',         price: 21000,   category: 'Ev & Yaşam',  location: LOCATIONS[5],  description: 'A++ enerji sınıfı, inox kaplama, çift soğutma sistemi.',               img: 27, condition: 'İkinci El - Az Kullanılmış' },
  { id: 28, title: 'Kütüphane Köşe Yazılık Bölümlü',         price: 8500,    category: 'Ev & Yaşam',  location: LOCATIONS[7],  description: 'Masif meşe, 5 bölüm, 200 kitap kapasiteli, ayarlanabilir raflar.',    img: 28, condition: 'İkinci El - Çok Temiz' },
  { id: 29, title: 'Moncler Grenoble Kayak Montu L',          price: 12500,   category: 'Moda',        location: LOCATIONS[4],  description: 'Orijinal, 800 fill power duck down, su geçirmez, L beden, siyah.',    img: 29, condition: 'İkinci El - Çok Temiz' },
  { id: 30, title: 'Nike Air Jordan 1 Mid SE 42.5',           price: 4200,    category: 'Moda',        location: LOCATIONS[8],  description: 'Az giyilmiş, kutusunda, orijinal, 42.5 numara Obsidian rengi.',       img: 30, condition: 'İkinci El - Az Kullanılmış' },
  { id: 31, title: "Levi's 501 Original 32/32",               price: 950,     category: 'Moda',        location: LOCATIONS[2],  description: 'Vintage wash, tapered fit, 100% pamuk, Türkiye orijinal etiketi.',    img: 31, condition: 'İkinci El - Çok Temiz' },
  { id: 32, title: 'Zara Premium Takım Elbise 52 Beden',      price: 2800,    category: 'Moda',        location: LOCATIONS[9],  description: 'Slim fit, lacivert, yünlü kumaş karışımı, kuru temizlemeli.',         img: 32, condition: 'İkinci El - Çok Temiz' },
  { id: 33, title: 'Gucci Dionysus GG Omuz Çantası',          price: 28000,   category: 'Moda',        location: LOCATIONS[0],  description: 'Orijinal sertifikalı, bej GG kanvas, çok az kullanılmış.',            img: 33, condition: 'İkinci El - Çok Temiz' },
  { id: 34, title: 'Adidas Ultraboost 22 43.5',               price: 2400,    category: 'Moda',        location: LOCATIONS[3],  description: 'Boost tabanlı koşu ayakkabısı, Primeknit+ üst, 43.5, Core Black.',  img: 34, condition: 'İkinci El - Az Kullanılmış' },
  { id: 35, title: 'Technogym Recline Excite+ Bisiklet',      price: 38000,   category: 'Spor',        location: LOCATIONS[5],  description: 'Profesyonel kondisyon bisikleti, 25 direnç seviyesi, LCD konsol.',    img: 35, condition: 'İkinci El - Az Kullanılmış' },
  { id: 36, title: 'Wilson Pro Staff RF97 Otograph',          price: 5800,    category: 'Spor',        location: LOCATIONS[14], description: '97 inç, 340gr, Federer versiyonu, black edition, kılıfıyla.',        img: 36, condition: 'İkinci El - Çok Temiz' },
  { id: 37, title: 'Bianchi Oltre XR4 Yol Bisikleti',        price: 85000,   category: 'Spor',        location: LOCATIONS[7],  description: 'Karbon frame, Shimano Ultegra Di2, 56cm, celeste rengi.',             img: 37, condition: 'İkinci El - Az Kullanılmış' },
  { id: 38, title: 'Garmin Fenix 7X Solar Smartwatch',        price: 18500,   category: 'Spor',        location: LOCATIONS[1],  description: 'Güneş enerjisi şarjı, 28 gün pil ömrü, çoklu spor modu, titanyum.', img: 38, condition: 'İkinci El - Az Kullanılmış' },
  { id: 39, title: 'Head i.Speed 115 Kayak Takımı',          price: 12000,   category: 'Spor',        location: LOCATIONS[11], description: 'Freestyle-All Mountain kayak, PR 11 GW bağlama dahil, 172cm.',       img: 39, condition: 'İkinci El' },
  { id: 40, title: 'Bowflex SelectTech 552 Dambıl Seti',     price: 9500,    category: 'Spor',        location: LOCATIONS[10], description: '2-24 kg arası ayarlanabilir, 15 farklı ağırlık, plastik kasa.',       img: 40, condition: 'İkinci El - Çok Temiz' },
  { id: 41, title: 'LEGO Technic 42083 Bugatti Chiron',      price: 8500,    category: 'Hobi',        location: LOCATIONS[4],  description: '3599 parça, orijinal kutu ve kılavuz dahil, eksiksiz.',               img: 41, condition: 'İkinci El - Çok Temiz' },
  { id: 42, title: 'Fender Stratocaster Player Series',       price: 32000,   category: 'Hobi',        location: LOCATIONS[0],  description: 'Polar white, maple klavye, 3-ply pickguard, çantayla birlikte.',     img: 42, condition: 'İkinci El - Az Kullanılmış' },
  { id: 43, title: 'Kitap Seti: Orhan Pamuk Tüm Eserleri',   price: 1200,    category: 'Hobi',        location: LOCATIONS[8],  description: '14 roman ve deneme kitabı, hepsi birinci baskı, sağlam ciltli.',     img: 43, condition: 'İkinci El - Çok Temiz' },
  { id: 44, title: 'Wacom Cintiq 22 Grafik Tablet',          price: 28000,   category: 'Hobi',        location: LOCATIONS[12], description: '21.5 inç FHD, 8192 basınç seviyesi, Pro Pen 2, stand dahil.',       img: 44, condition: 'İkinci El - Az Kullanılmış' },
  { id: 45, title: 'Makita Akülü Matkap DHP485',             price: 5200,    category: 'Yapı Market', location: LOCATIONS[3],  description: '18V LXT, BL motor, 2x5.0Ah pil + hızlı şarj cihazı dahil.',        img: 45, condition: 'İkinci El - Az Kullanılmış' },
  { id: 46, title: 'Bahçe Mobilya Takımı Rattan 6 Kişilik',  price: 22000,   category: 'Yapı Market', location: LOCATIONS[6],  description: 'PE rattan, alüminyum iskelet, yağmur dayanıklı, minderler dahil.',  img: 46, condition: 'İkinci El - Çok Temiz' },
  { id: 47, title: 'Weber Spirit E-310 Barbekü Izgara',       price: 14500,   category: 'Yapı Market', location: LOCATIONS[11], description: '3 brülör, 7.200 watt, emaye ızgara, kapak termometresi dahil.',     img: 47, condition: 'İkinci El - Az Kullanılmış' },
  { id: 48, title: 'Husqvarna Automower 450X Robomow',        price: 28000,   category: 'Yapı Market', location: LOCATIONS[1],  description: '5000m² alan, eğimli arazi, akıllı telefon kontrolü, GPS takip.',    img: 48, condition: 'İkinci El - Az Kullanılmış' },
  { id: 49, title: 'Stihl MS 261 C-M Zincir Testere',        price: 9800,    category: 'Yapı Market', location: LOCATIONS[5],  description: '50.2cc, M-Tronic otomatik ayar, 40cm bar, az kullanılmış.',         img: 49, condition: 'İkinci El - Az Kullanılmış' },
  { id: 50, title: 'Kärcher K7 Premium Yüksek Basınçlı',     price: 8900,    category: 'Yapı Market', location: LOCATIONS[7],  description: '180 bar, 600 l/h, Home Kit dahil, su soğutmalı motor.',             img: 50, condition: 'İkinci El - Çok Temiz' },
]

// Kategorien aus RAW (Titel-Case) → Kleinbuchstaben wie auf Live-Site
function normCat(cat: string): string {
  const map: Record<string, string> = {
    'Araba': 'araba',
    'Motosiklet': 'motosiklet',
    'Elektronik': 'elektronik',
    'Ev & Yaşam': 'ev-yasam',
    'Moda': 'giyim',
    'Spor': 'spor',
    'Hobi': 'hobi',
    'Yapı Market': 'yapi-market',
  }
  return map[cat] ?? cat.toLowerCase()
}

const RAW_MOCK_LISTINGS: Listing[] = RAW.map((r, idx) => {
  const n = idx + 1
  const isKurumsal = pw(n)
  const badge = Qe(n)
  const sellerName = isKurumsal
    ? pi[(n - 1) % pi.length]
    : pl[(n - 1) % pl.length]
  // F-XXXXX Format wie auf kapbeni.com Live-Site
  const fId = 'F-' + String(r.id).padStart(5, '0')
  return {
    id: fId,
    title: r.title,
    price: r.price,
    category: normCat(r.category),
    location: r.location,
    date: DATES[(n - 1) % DATES.length],
    image: se(r.img),
    description: r.description,
    sellerName,
    sellerPhone: '',
    isFavorite: false,
    condition: r.condition,
    ...(badge ? { badge } : {}),
    ...(isKurumsal ? { isKurumsal: true } : {}),
  }
})

// Echte Live-Anzeigen zuerst, dann Mock-Daten (wie auf kapbeni.com)
export const MOCK_LISTINGS: Listing[] = [...REAL_LISTINGS, ...RAW_MOCK_LISTINGS]

export const MOCK_CHATS: AppChat[] = [
  {
    id: 'chat_1',
    listingId: 'F-00016',
    listingTitle: 'PlayStation 5 Disc Edition',
    listingPrice: 22500,
    listingImage: se(16),
    sellerName: 'Gizem Polat',
    messages: [
      {
        id: '1',
        sender: 'user',
        text: 'Merhaba, ilan hala güncel mi? En son ne kadar olur acaba?',
        timestamp: '15:24',
      },
      {
        id: '2',
        sender: 'seller',
        text: 'Merhaba, evet konsol hala satılık. Kutusunda ve çok az kullanılmış, pazarlık payı çok azdır.',
        timestamp: '15:26',
      },
    ],
    unread: true,
  },
  {
    id: 'chat_2',
    listingId: 'F-00023',
    listingTitle: 'Kanepe Takımı 3+2+1 Köşeli',
    listingPrice: 18500,
    listingImage: se(23),
    sellerName: 'Can Özkan',
    messages: [
      {
        id: '1',
        sender: 'user',
        text: 'Selam, kanepenin ölçülerini paylaşabilir misiniz?',
        timestamp: 'Dün',
      },
      {
        id: '2',
        sender: 'seller',
        text: 'Tabii, köşe dahil toplam 280cm, derinlik 90cm. Çok rahat ve geniş bir oturuma sahip.',
        timestamp: 'Dün',
      },
    ],
    unread: false,
  },
]
