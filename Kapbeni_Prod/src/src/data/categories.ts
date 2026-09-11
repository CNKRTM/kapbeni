// Kategori ağacı — KapBeni v14
// GLOBAL ICON RULE: Tabler Icons webfont (ti-* classes), thin-line style on white circles with shadow.
// Never use Lucide for category icons.

export interface SubCategory {
  id: string
  label: string
  group?: string   // optional grouping label for mega-menu display
}

export interface Category {
  id: string
  label: string
  icon: string     // Tabler Icons class, e.g. "ti-car"
  sub: SubCategory[]
}

export const CATEGORIES: Category[] = [
  {
    id: "araba",
    label: "Araba",
    icon: "ti-car",
    sub: [
      { id: "otomobil-renault", label: "Renault", group: "Araba" },
      { id: "otomobil-vw", label: "Volkswagen", group: "Araba" },
      { id: "otomobil-fiat", label: "Fiat", group: "Araba" },
      { id: "otomobil-ford", label: "Ford", group: "Araba" },
      { id: "otomobil-opel", label: "Opel", group: "Araba" },
      { id: "otomobil-peugeot", label: "Peugeot", group: "Araba" },
      { id: "otomobil-toyota", label: "Toyota", group: "Araba" },
      { id: "otomobil-honda", label: "Honda", group: "Araba" },
      { id: "otomobil-bmw", label: "BMW", group: "Araba" },
      { id: "otomobil-mercedes", label: "Mercedes", group: "Araba" },
      { id: "otomobil-hyundai", label: "Hyundai", group: "Araba" },
      { id: "otomobil-diger", label: "Diğer Markalar", group: "Araba" },
      { id: "suv", label: "SUV & Arazi", group: "Araba" },
      { id: "minivan", label: "Minivan & Panelvan", group: "Araba" },
      { id: "klasik-araba", label: "Klasik Araç", group: "Araba" },
      { id: "kiralik-arac", label: "Kiralık Araçlar", group: "Araba" },
      { id: "motor-parca", label: "Motor", group: "Oto Yedek Parça" },
      { id: "sanziman-parca", label: "Şanzıman", group: "Oto Yedek Parça" },
      { id: "fren-parca", label: "Fren Sistemi", group: "Oto Yedek Parça" },
      { id: "elektrik-parca", label: "Elektrik & Elektronik", group: "Oto Yedek Parça" },
      { id: "kaporta-parca", label: "Kaporta & Karoser", group: "Oto Yedek Parça" },
      { id: "araba-yedek-diger", label: "Diğer Yedek Parça", group: "Oto Yedek Parça" },
      { id: "jant", label: "Jant", group: "Jant & Lastik" },
      { id: "lastik", label: "Lastik", group: "Jant & Lastik" },
      { id: "araba-aksesuar", label: "Aksesuar & Tuning", group: "Aksesuar & Tuning" },
      { id: "ses-goruntusu", label: "Ses & Görüntü Sistemleri", group: "Aksesuar & Tuning" },
    ],
  },
  {
    id: "telefon",
    label: "Telefon",
    icon: "ti-device-mobile",
    sub: [
      { id: "iphone-17-pro-max", label: "iPhone 17 Pro Max", group: "iPhone / iOS Telefon" },
      { id: "iphone-17-pro", label: "iPhone 17 Pro", group: "iPhone / iOS Telefon" },
      { id: "iphone-17", label: "iPhone 17", group: "iPhone / iOS Telefon" },
      { id: "iphone-16-pro-max", label: "iPhone 16 Pro Max", group: "iPhone / iOS Telefon" },
      { id: "iphone-16-pro", label: "iPhone 16 Pro", group: "iPhone / iOS Telefon" },
      { id: "iphone-16", label: "iPhone 16", group: "iPhone / iOS Telefon" },
      { id: "iphone-15", label: "iPhone 15", group: "iPhone / iOS Telefon" },
      { id: "iphone-diger", label: "Diğer iPhone", group: "iPhone / iOS Telefon" },
      { id: "android-samsung", label: "Samsung", group: "Android Telefon" },
      { id: "android-xiaomi", label: "Xiaomi", group: "Android Telefon" },
      { id: "android-huawei", label: "Huawei", group: "Android Telefon" },
      { id: "android-oppo", label: "Oppo", group: "Android Telefon" },
      { id: "android-poco", label: "Poco", group: "Android Telefon" },
      { id: "android-infinix", label: "Infinix", group: "Android Telefon" },
      { id: "android-tecno", label: "Tecno", group: "Android Telefon" },
      { id: "android-realme", label: "Realme", group: "Android Telefon" },
      { id: "android-vivo", label: "Vivo", group: "Android Telefon" },
      { id: "android-diger", label: "Diğer Android", group: "Android Telefon" },
      { id: "sarj-cihazi", label: "Şarj Cihazı", group: "Telefon Aksesuarları" },
      { id: "bt-kulaklik", label: "Bluetooth Kulaklık", group: "Telefon Aksesuarları" },
      { id: "kablolu-kulaklik", label: "Kablolu Kulaklık", group: "Telefon Aksesuarları" },
      { id: "telefon-kilifi", label: "Telefon Kılıfı", group: "Telefon Aksesuarları" },
      { id: "ekran-koruyucu", label: "Ekran Koruyucu", group: "Telefon Aksesuarları" },
      { id: "selfie-cubugu", label: "Selfie Çubuğu & Stand", group: "Telefon Aksesuarları" },
      { id: "batarya-parca", label: "Batarya", group: "Telefon Yedek Parçaları" },
      { id: "ekran-parca", label: "Ekran", group: "Telefon Yedek Parçaları" },
      { id: "anakart-parca", label: "Anakart", group: "Telefon Yedek Parçaları" },
      { id: "kasa-kapak", label: "Kasa & Kapak", group: "Telefon Yedek Parçaları" },
      { id: "telefon-yedek-diger", label: "Diğer Yedek Parça", group: "Telefon Yedek Parçaları" },
      { id: "diger-telefon", label: "Diğer Cep Telefonları", group: "Diğer" },
      { id: "telsiz-masaustu", label: "Telsiz & Masaüstü Telefon", group: "Diğer" },
    ],
  },
  {
    id: "elektronik",
    label: "Elektronik",
    icon: "ti-cpu",
    sub: [
      { id: "dizustu-bilgisayar", label: "Dizüstü Bilgisayar", group: "Bilgisayar" },
      { id: "masaustu-bilgisayar", label: "Masaüstü Bilgisayar", group: "Bilgisayar" },
      { id: "monitor", label: "Monitör", group: "Bilgisayar" },
      { id: "sunucu", label: "Sunucu", group: "Bilgisayar" },
      { id: "yazici-tarayici", label: "Yazıcı & Tarayıcı", group: "Bilgisayar" },
      { id: "bilgisayar-aksesuar", label: "Bilgisayar Aksesuarları", group: "Bilgisayar" },
      { id: "modem", label: "Modem & Router", group: "Bilgisayar" },
      { id: "bilgisayar-bilesenleri", label: "Bilgisayar Bileşenleri", group: "Bilgisayar" },
      { id: "tablet", label: "Tablet", group: "Tablet" },
      { id: "e-kitap", label: "E-Kitap Okuyucu", group: "Tablet" },
      { id: "tablet-aksesuar", label: "Tablet Aksesuarları", group: "Tablet" },
      { id: "oyun-konsolu", label: "Oyun Konsolu", group: "Oyunculara Özel" },
      { id: "oyun-kolu", label: "Oyun Kolu & Aksesuar", group: "Oyunculara Özel" },
      { id: "gaming-ekipman", label: "Gaming Ekipman", group: "Oyunculara Özel" },
      { id: "televizyon", label: "Televizyon", group: "TV / Görüntü & Ses" },
      { id: "ses-sistemi", label: "Ses Sistemi & Hoparlör", group: "TV / Görüntü & Ses" },
      { id: "projektor", label: "Projeksiyon & Sinema", group: "TV / Görüntü & Ses" },
      { id: "kucuk-ev-aleti", label: "Küçük Ev Aletleri", group: "Elektrikli Ev Aletleri" },
      { id: "supurge-robot", label: "Süpürge & Robot Süpürge", group: "Elektrikli Ev Aletleri" },
      { id: "kamera", label: "Fotoğraf & Kamera", group: "Fotoğraf & Kamera" },
      { id: "kamera-aksesuar", label: "Kamera Aksesuarları", group: "Fotoğraf & Kamera" },
      { id: "giyilebilir", label: "Akıllı Saat & Bileklik", group: "Giyilebilir Teknoloji" },
      { id: "kupe-kulaklik", label: "TWS & Kablosuz Kulaklık", group: "Giyilebilir Teknoloji" },
      { id: "beyaz-esya", label: "Beyaz Eşya", group: "Beyaz Eşya" },
      { id: "isitma-sogutma", label: "Isıtma & Soğutma", group: "Beyaz Eşya" },
      { id: "elektronik-diger", label: "Diğer Elektronik", group: "Diğer" },
    ],
  },
  {
    id: "ev-yasam",
    label: "Ev & Yaşam",
    icon: "ti-armchair",
    sub: [
      { id: "mobilya", label: "Mobilya", group: "Mobilya" },
      { id: "oturma-odasi", label: "Oturma Odası", group: "Mobilya" },
      { id: "yatak-odasi", label: "Yatak Odası", group: "Mobilya" },
      { id: "yemek-odasi", label: "Yemek Odası & Mutfak Mobilyası", group: "Mobilya" },
      { id: "mutfak-esyasi", label: "Mutfak Gereçleri", group: "Mutfak Gereçleri & Sofra" },
      { id: "sofra-takimi", label: "Sofra Takımı", group: "Mutfak Gereçleri & Sofra" },
      { id: "bardak-kupa", label: "Bardak & Kupa", group: "Mutfak Gereçleri & Sofra" },
      { id: "tekstil", label: "Yatak & Yorgan", group: "Ev Tekstili" },
      { id: "perde-hali", label: "Perde & Halı", group: "Ev Tekstili" },
      { id: "havlu-bornoz", label: "Havlu & Bornoz", group: "Ev Tekstili" },
      { id: "dekorasyon", label: "Ev Dekorasyonu", group: "Ev Dekorasyonu" },
      { id: "tablo-cerceve", label: "Tablo & Çerçeve", group: "Ev Dekorasyonu" },
      { id: "vazo-mumluk", label: "Vazo & Mumluk", group: "Ev Dekorasyonu" },
      { id: "aydinlatma", label: "Aydınlatma", group: "Aydınlatma" },
      { id: "avize-lamba", label: "Avize & Lamba", group: "Aydınlatma" },
      { id: "banyo", label: "Banyo & Tuvalet", group: "Ev Gereçleri" },
      { id: "temizlik-urun", label: "Temizlik Ürünleri", group: "Ev Gereçleri" },
      { id: "ev-diger", label: "Diğer Ev Eşyası", group: "Ev Gereçleri" },
    ],
  },
  {
    id: "motosiklet",
    label: "Motosiklet",
    icon: "ti-motorbike",
    sub: [
      { id: "moto-honda", label: "Honda", group: "Motosiklet" },
      { id: "moto-mondial", label: "Mondial", group: "Motosiklet" },
      { id: "moto-kuba", label: "Kuba", group: "Motosiklet" },
      { id: "moto-arora", label: "Arora", group: "Motosiklet" },
      { id: "moto-rks", label: "RKS", group: "Motosiklet" },
      { id: "moto-yamaha", label: "Yamaha", group: "Motosiklet" },
      { id: "moto-diger", label: "Diğer Markalar", group: "Motosiklet" },
      { id: "scooter", label: "Scooter & Moped", group: "Motosiklet" },
      { id: "motosiklet-aksesuar", label: "Aksesuarlar", group: "Aksesuar & Parça" },
      { id: "motosiklet-parca", label: "Yedek Parça", group: "Aksesuar & Parça" },
      { id: "moto-jant-lastik", label: "Jant & Lastik", group: "Aksesuar & Parça" },
      { id: "kask-acik", label: "Açık Kask", group: "Kask" },
      { id: "kask-kapali", label: "Kapalı Kask", group: "Kask" },
      { id: "kask-cene-acilir", label: "Çeneden Açılır Kask", group: "Kask" },
      { id: "kask-krosa", label: "Kros & Enduro Kask", group: "Kask" },
      { id: "kask-chopper", label: "Chopper Kask", group: "Kask" },
      { id: "kask-cocuk", label: "Çocuk Kaskı", group: "Kask" },
      { id: "kask-vizor", label: "Vizör", group: "Kask" },
      { id: "moto-giyim", label: "Giyim & Ekipman", group: "Giyim & Ekipman" },
    ],
  },
  {
    id: "giyim",
    label: "Giyim & Aksesuar",
    icon: "ti-shirt",
    sub: [
      { id: "kadin-ust-giyim", label: "Üst Giyim", group: "Kadın" },
      { id: "kadin-alt-giyim", label: "Alt Giyim", group: "Kadın" },
      { id: "kadin-dis-giyim", label: "Dış Giyim & Mont", group: "Kadın" },
      { id: "kadin-elbise", label: "Elbise & Etek", group: "Kadın" },
      { id: "kadin-ev-giyim", label: "Ev Giyimi & Pijama", group: "Kadın" },
      { id: "kadin-plaj", label: "Mayo & Bikini", group: "Kadın" },
      { id: "kadin-ayakkabi", label: "Kadın Ayakkabı", group: "Kadın" },
      { id: "kadin-canta", label: "Kadın Çanta", group: "Kadın" },
      { id: "erkek-ust-giyim", label: "Üst Giyim", group: "Erkek" },
      { id: "erkek-alt-giyim", label: "Alt Giyim", group: "Erkek" },
      { id: "erkek-dis-giyim", label: "Dış Giyim & Mont", group: "Erkek" },
      { id: "erkek-takim-elbise", label: "Takım Elbise & Gömlek", group: "Erkek" },
      { id: "erkek-ev-giyim", label: "Ev Giyimi & Pijama", group: "Erkek" },
      { id: "erkek-ayakkabi", label: "Erkek Ayakkabı", group: "Erkek" },
      { id: "erkek-canta", label: "Erkek Çanta & Sırt Çantası", group: "Erkek" },
      { id: "kiz-cocuk-giyim", label: "Kız Çocuk Giyim", group: "Çocuk" },
      { id: "erkek-cocuk-giyim", label: "Erkek Çocuk Giyim", group: "Çocuk" },
      { id: "cocuk-ayakkabi", label: "Çocuk Ayakkabı", group: "Çocuk" },
      { id: "cocuk-aksesuar", label: "Çocuk Aksesuar", group: "Çocuk" },
      { id: "saat", label: "Saat", group: "Aksesuar" },
      { id: "taki", label: "Takı & Mücevher", group: "Aksesuar" },
      { id: "gozluk", label: "Gözlük & Güneş Gözlüğü", group: "Aksesuar" },
      { id: "giyim-aksesuar", label: "Diğer Aksesuar", group: "Aksesuar" },
    ],
  },
  {
    id: "kisisel-bakim",
    label: "Kişisel Bakım",
    icon: "ti-sparkles",
    sub: [
      { id: "bakim-aletleri", label: "Kişisel Bakım Aletleri" },
      { id: "makyaj", label: "Makyaj" },
      { id: "cilt-bakim", label: "Cilt Bakımı" },
      { id: "sac-bakim", label: "Saç Bakımı" },
      { id: "tirnak-bakim", label: "Tırnak Bakımı" },
      { id: "parfum", label: "Parfüm" },
      { id: "deodorant", label: "Deodorant" },
    ],
  },
  {
    id: "anne-bebek",
    label: "Anne & Bebek",
    icon: "ti-baby-carriage",
    sub: [
      { id: "bebek-arabasi", label: "Bebek Arabası & Taşıma", group: "Bebek Araç & Gereçleri" },
      { id: "bebek-ana-kucagi", label: "Ana Kucağı & Oto Koltuğu", group: "Bebek Araç & Gereçleri" },
      { id: "bebek-beslenme", label: "Bebek Beslenmesi", group: "Anne & Bebek Bakımı" },
      { id: "bebek-banyo", label: "Bebek Banyosu & Bakımı", group: "Anne & Bebek Bakımı" },
      { id: "emzirme-urunleri", label: "Emzirme Ürünleri", group: "Anne & Bebek Bakımı" },
      { id: "bebek-karyola", label: "Karyola & Beşik", group: "Bebek Odası & Mobilya" },
      { id: "bebek-mobilya", label: "Bebek Odası Mobilyası", group: "Bebek Odası & Mobilya" },
      { id: "bebek-giyim", label: "Bebek Giyim (0-2 Yaş)", group: "Bebek Giyim" },
      { id: "cocuk-giyim-kucuk", label: "Çocuk Giyim (2-6 Yaş)", group: "Bebek Giyim" },
      { id: "oyuncak", label: "Oyuncak", group: "Oyuncak" },
      { id: "cocuk-oyun", label: "Çocuk Oyun & Eğlence", group: "Oyuncak" },
      { id: "anne-bebek-diger", label: "Diğer", group: "Oyuncak" },
    ],
  },
  {
    id: "hobi",
    label: "Hobi & Müzik",
    icon: "ti-music",
    sub: [
      { id: "kutu-masa-oyunu", label: "Kutu ve Masa Oyunları", group: "Hobi" },
      { id: "puzzle", label: "Puzzle", group: "Hobi" },
      { id: "film-muzik-hobi", label: "Film & Müzik", group: "Hobi" },
      { id: "koleksiyon", label: "Koleksiyon", group: "Hobi" },
      { id: "model-arac", label: "Model Araçlar", group: "Hobi" },
      { id: "orgü-el-isi", label: "Örgü & El İşi", group: "Hobi" },
      { id: "drone", label: "Drone & Uçak Modeli", group: "Hobi" },
      { id: "nargile-aksesuar", label: "Nargile Aksesuarları", group: "Hobi" },
      { id: "kitap", label: "Kitap", group: "Kitap" },
      { id: "dergi-gazete", label: "Dergi & Gazete", group: "Kitap" },
      { id: "muzik-aleti", label: "Müzik Aletleri", group: "Müzik" },
      { id: "nota-plak", label: "Nota, Plak & CD", group: "Müzik" },
      { id: "sanat", label: "Sanat & El İşi Malzemeleri", group: "Müzik" },
    ],
  },
  {
    id: "ofis",
    label: "Ofis & Kırtasiye",
    icon: "ti-briefcase",
    sub: [
      { id: "ofis-mobilya", label: "Ofis Mobilyası" },
      { id: "fotokopi-kagit", label: "Fotokopi Kâğıdı" },
      { id: "yazi-tahtasi", label: "Yazı Tahtası & Pano" },
      { id: "kirtasiye", label: "Okul & Kırtasiye" },
      { id: "masa-ustu", label: "Masa Üstü Gereçleri" },
      { id: "sanatsal-boya", label: "Sanatsal Boya & Malzeme" },
      { id: "ofis-teknoloji", label: "Ofis Teknolojileri" },
      { id: "is-makinesi", label: "İş Makineleri" },
      { id: "ofis-diger", label: "Diğer" },
    ],
  },
  {
    id: "spor",
    label: "Spor & Outdoor",
    icon: "ti-barbell",
    sub: [
      { id: "fitness", label: "Fitness & Spor Aletleri" },
      { id: "bisiklet", label: "Bisiklet" },
      { id: "kamp", label: "Kamp & Doğa Sporları" },
      { id: "su-sporlari", label: "Su Sporları" },
      { id: "spor-giyim", label: "Spor Giyim & Ayakkabı" },
      { id: "futbol", label: "Futbol & Top Sporları" },
      { id: "tenis-raket", label: "Tenis & Raket Sporları" },
      { id: "kayak-buz", label: "Kayak & Buz Sporları" },
      { id: "spor-diger", label: "Diğer Spor" },
    ],
  },
  {
    id: "yapi-market",
    label: "Yapı Market & Bahçe",
    icon: "ti-hammer",
    sub: [
      { id: "el-aleti", label: "El Aletleri" },
      { id: "elektrikli-alet", label: "Elektrikli Aletler" },
      { id: "elektrik-malzeme", label: "Elektrik Malzemeleri" },
      { id: "boru-tesisat", label: "Boru & Tesisat Malzemeleri" },
      { id: "bahce", label: "Bahçe & Peyzaj" },
      { id: "tarim", label: "Tarım Ekipmanları" },
      { id: "yapi-diger", label: "Diğer Yapı Market" },
    ],
  },
  {
    id: "pet-shop",
    label: "Pet Shop",
    icon: "ti-paw",
    sub: [
      { id: "kopek", label: "Köpek Malzemeleri" },
      { id: "kedi", label: "Kedi Malzemeleri" },
      { id: "kus", label: "Kuş Malzemeleri" },
      { id: "balik", label: "Akvaryum & Balık" },
      { id: "kemirgen", label: "Kemirgen & Diğer" },
      { id: "diger-pet", label: "Diğer Evcil Hayvan" },
    ],
  },
  {
    id: "antika",
    label: "Antika",
    icon: "ti-building-arch",
    sub: [
      { id: "antika-esya", label: "Antika Eşya" },
      { id: "tablo", label: "Tablo & Sanat Eseri" },
      { id: "pul-para", label: "Pul & Para Koleksiyonu" },
      { id: "antika-mobilya", label: "Antika Mobilya" },
      { id: "antika-diger", label: "Diğer Antika" },
    ],
  },
  {
    id: "emlak",
    label: "Emlak",
    icon: "ti-building-skyscraper",
    sub: [
      { id: "satilik-daire", label: "Satılık Daire" },
      { id: "kiralik-daire", label: "Kiralık Daire" },
      { id: "satilik-villa", label: "Satılık Villa & Müstakil" },
      { id: "kiralik-villa", label: "Kiralık Villa & Müstakil" },
      { id: "isyeri", label: "İşyeri & Ofis" },
      { id: "arsa", label: "Arsa & Tarla" },
      { id: "depo-saha", label: "Depo & Saha" },
    ],
  },
  {
    id: "hizmetler",
    label: "Hizmetler",
    icon: "ti-tool",
    sub: [
      { id: "temizlik", label: "Temizlik Hizmetleri", group: "Ev & Tadilat" },
      { id: "tamirat-tadilat", label: "Tamirat & Tadilat", group: "Ev & Tadilat" },
      { id: "boyaci", label: "Boyacı", group: "Ev & Tadilat" },
      { id: "fayans-seramik", label: "Fayans & Seramik Döşeme", group: "Ev & Tadilat" },
      { id: "parke-zemin", label: "Parke & Zemin Döşeme", group: "Ev & Tadilat" },
      { id: "alcipan", label: "Alçıpan & Asma Tavan", group: "Ev & Tadilat" },
      { id: "cilingir", label: "Çilingir", group: "Ev & Tadilat" },
      { id: "elektrik-tesisat", label: "Elektrik & Tesisat", group: "Tesisat & Teknik" },
      { id: "su-tesisat", label: "Su Tesisatı & Sıhhi Tesisat", group: "Tesisat & Teknik" },
      { id: "klima-montaj", label: "Klima Montaj & Bakım", group: "Tesisat & Teknik" },
      { id: "uydu-anten", label: "Uydu & Anten Kurulum", group: "Tesisat & Teknik" },
      { id: "beyaz-esya-tamir", label: "Beyaz Eşya Tamir", group: "Tesisat & Teknik" },
      { id: "nakliyat", label: "Nakliyat & Taşımacılık", group: "Taşıma" },
      { id: "sehir-ici-nakliye", label: "Şehir İçi Nakliye", group: "Taşıma" },
      { id: "ofis-tasima", label: "Ofis Taşıma", group: "Taşıma" },
      { id: "piyano-kasa-tasima", label: "Piyano & Kasa Taşıma", group: "Taşıma" },
      { id: "el-yapimi", label: "El Yapımı Ürünler", group: "El Yapımı & Özel" },
      { id: "ozel-siparis", label: "Özel Sipariş & Tasarım", group: "El Yapımı & Özel" },
      { id: "pasta-borek", label: "Pasta & Börek Siparişi", group: "El Yapımı & Özel" },
      { id: "ev-yemegi", label: "Ev Yemeği & Catering", group: "El Yapımı & Özel" },
      { id: "dikis-terzilik", label: "Dikiş & Terzilik", group: "El Yapımı & Özel" },
      { id: "ozel-ders", label: "Özel Ders", group: "Eğitim & Diğer" },
      { id: "yazilim-bilisim", label: "Yazılım & Bilişim", group: "Eğitim & Diğer" },
      { id: "fotograf-video", label: "Fotoğraf & Video Çekim", group: "Eğitim & Diğer" },
      { id: "organizasyon", label: "Organizasyon & Etkinlik", group: "Eğitim & Diğer" },
      { id: "guzellik-hizmet", label: "Güzellik & Bakım Hizmetleri", group: "Eğitim & Diğer" },
      { id: "hayvan-bakimi", label: "Hayvan Bakımı", group: "Eğitim & Diğer" },
      { id: "diger-hizmet", label: "Diğer Hizmet", group: "Eğitim & Diğer" },
    ],
  },
  {
    id: "diger",
    label: "Diğer",
    icon: "ti-package",
    sub: [
      { id: "tarim-hayvancilik", label: "Tarım & Hayvancılık" },
      { id: "tekne-deniz", label: "Tekne & Deniz Araçları" },
      { id: "endustriyel-makine", label: "Endüstriyel Makine & Ekipman" },
      { id: "medikal", label: "Medikal & Sağlık Ekipmanı" },
      { id: "is-firsati", label: "İş Fırsatları & Ortaklık" },
      { id: "diger-ilan", label: "Diğer İlanlar" },
    ],
  },
];

// ─── Hero Slider ──────────────────────────────────────────────────────────────

export interface HeroSlide {
  category: string
  tagline: string
  description: string
  image: string
  primaryCta: string
  secondaryCta: string
  accent: string
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    category: "ARABA.",
    tagline: "Hayalindeki Aracı Bul.",
    description: "Türkiye'nin en büyük ikinci el araç pazarında güvenle al ve sat.",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80",
    primaryCta: "İlan Ver",
    secondaryCta: "Araçları Keşfet",
    accent: "from-black/80 via-black/45 to-transparent",
  },
  {
    category: "ELEKTRONİK.",
    tagline: "Geleceği Keşfet.",
    description: "Telefon, bilgisayar, tablet ve daha fazlası — uygun fiyata, güvenli alışveriş.",
    image: "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?auto=format&fit=crop&w=1600&q=80",
    primaryCta: "Hemen Bak",
    secondaryCta: "İlan Ver",
    accent: "from-black/75 via-black/40 to-transparent",
  },
  {
    category: "EMLAK.",
    tagline: "Hayalindeki Evi Bul.",
    description: "Kiralık, satılık daire ve ev ilanları — şehrin dört bir yanında.",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80",
    primaryCta: "İlanları Gör",
    secondaryCta: "İlan Ver",
    accent: "from-black/80 via-black/40 to-transparent",
  },
  {
    category: "MODA.",
    tagline: "Stilini Yenile.",
    description: "Markalar, vintage parçalar ve el yapımı tasarımlar — modayı keşfet.",
    image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1600&q=80",
    primaryCta: "Keşfet",
    secondaryCta: "Sat",
    accent: "from-black/75 via-black/35 to-transparent",
  },
  {
    category: "SPOR.",
    tagline: "Aktif Ol, Daha Az Harca.",
    description: "Bisiklet, fitness ekipmanı, outdoor malzemeleri — ikinci el kalitede.",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80",
    primaryCta: "İncele",
    secondaryCta: "İlan Ver",
    accent: "from-black/80 via-black/40 to-transparent",
  },
]

// ─── Trend Kategoriler ────────────────────────────────────────────────────────
// NOTE: Trend kategoriler still uses Lucide for backward compatibility.
// New components should use Tabler Icons webfont (ti-* classes) instead.

import {
  Car, Building2, Cpu, Sparkles, Armchair,
  Dumbbell, Baby
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface TrendKategori {
  name: string
  icon: LucideIcon
  bg: string
}

export const TREND_KATEGORILER: TrendKategori[] = [
  { name: "Araba",        icon: Car,       bg: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" },
  { name: "Emlak",        icon: Building2, bg: "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100" },
  { name: "Elektronik",   icon: Cpu,       bg: "bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100" },
  { name: "Moda",         icon: Sparkles,  bg: "bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100" },
  { name: "Ev & Yaşam",  icon: Armchair,  bg: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" },
  { name: "Spor",         icon: Dumbbell,  bg: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" },
  { name: "Anne & Bebek", icon: Baby,      bg: "bg-sky-50 text-sky-500 border-sky-200 hover:bg-sky-100" },
]

// ─── Feature Kacheln ──────────────────────────────────────────────────────────

import { ShieldCheck, Gift, Users, TrendingDown, PackageCheck, Building2 as Building2Icon } from 'lucide-react'

export interface FeatureKachel {
  icon: LucideIcon
  color: string
  title: string
  desc: string
}

export const FEATURE_KACHELN: FeatureKachel[] = [
  { icon: ShieldCheck,   color: "from-primary to-primary-container",  title: "Güvenli Alışveriş",   desc: "İpuçları ve anlaşma notu ile emniyetli alışveriş yapın" },
  { icon: Gift,          color: "from-purple-500 to-purple-600",       title: "İlk 3 Ay Ücretsiz",  desc: "Tüm yeni üyeler için geçerli, kredi kartı gerekmez" },
  { icon: Users,         color: "from-secondary to-blue-700",          title: "Milyonlarca Alıcı",  desc: "Geniş kullanıcı kitlesiyle ilanlarınız hızla satılır" },
  { icon: TrendingDown,  color: "from-tertiary to-green-800",          title: "En Uygun Fiyatlar",  desc: "İkinci el ürünlerde en iyi fiyatları bulun" },
  { icon: PackageCheck,  color: "from-amber-500 to-amber-600",         title: "Her Şeyi Sat",       desc: "Elektronik, giyim, ev eşyası – her kategoride ilan verin" },
  { icon: Building2Icon, color: "from-teal-500 to-teal-600",           title: "Kurumsal Çözümler",  desc: "Firmalar için özel paketler ve öncelikli destek" },
]
