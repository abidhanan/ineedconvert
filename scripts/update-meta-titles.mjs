import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const titles = {
  af: 'Skakel alle lêers gratis om', am: 'ሁሉንም ፋይሎች በነጻ ይቀይሩ', ar: 'حوّل جميع الملفات مجانًا',
  az: 'Bütün faylları pulsuz çevirin', be: 'Канвертуйце ўсе файлы бясплатна', bg: 'Конвертирайте всички файлове безплатно',
  bn: 'সব ফাইল বিনামূল্যে রূপান্তর করুন', bs: 'Konvertujte sve fajlove besplatno', ca: 'Converteix tots els fitxers gratis',
  cs: 'Převeďte všechny soubory zdarma', cy: 'Trosi pob ffeil am ddim', da: 'Konvertér alle filer gratis',
  de: 'Alle Dateien kostenlos konvertieren', el: 'Μετατρέψτε όλα τα αρχεία δωρεάν', en: 'Convert All Files for Free',
  es: 'Convierte todos los archivos gratis', et: 'Teisenda kõik failid tasuta', eu: 'Bihurtu fitxategi guztiak doan',
  fa: 'همه فایل‌ها را رایگان تبدیل کنید', fi: 'Muunna kaikki tiedostot ilmaiseksi', fr: 'Convertissez tous vos fichiers gratuitement',
  ga: 'Tiontaigh gach comhad saor in aisce', gl: 'Converte todos os ficheiros de balde', gu: 'બધી ફાઇલો મફતમાં કન્વર્ટ કરો',
  ha: 'Canza duk fayiloli kyauta', he: 'המרת כל הקבצים בחינם', hi: 'सभी फ़ाइलें मुफ़्त में कन्वर्ट करें',
  hr: 'Pretvorite sve datoteke besplatno', ht: 'Konvèti tout fichye gratis', hu: 'Konvertálj minden fájlt ingyen',
  hy: 'Փոխարկեք բոլոր ֆայլերն անվճար', id: 'Konversi Semua File Gratis', ig: "Gbanwee faịlụ niile n'efu",
  is: 'Umbreyttu öllum skrám ókeypis', it: 'Converti tutti i file gratis', ja: 'すべてのファイルを無料で変換',
  jv: 'Konversi Kabeh File Gratis', ka: 'გადააკეთეთ ყველა ფაილი უფასოდ', kk: 'Барлық файлдарды тегін түрлендіріңіз',
  km: 'បំប្លែងឯកសារទាំងអស់ដោយឥតគិតថ្លៃ', kn: 'ಎಲ್ಲಾ ಫೈಲ್‌ಗಳನ್ನು ಉಚಿತವಾಗಿ ಪರಿವರ್ತಿಸಿ', ko: '모든 파일을 무료로 변환',
  ku: 'Hemû pelan belaş veguherîne', ky: 'Бардык файлдарды акысыз айландырыңыз', lb: 'All Dateien gratis konvertéieren',
  lo: 'ແປງທຸກໄຟລ໌ຟຣີ', lt: 'Konvertuokite visus failus nemokamai', lv: 'Konvertējiet visus failus bez maksas',
  mg: 'Ovay maimaim-poana ny rakitra rehetra', mi: 'Tahurihia ngā kōnae katoa mō te kore utu', mk: 'Конвертирајте ги сите датотеки бесплатно',
  ml: 'എല്ലാ ഫയലുകളും സൗജന്യമായി കൺവേർട്ട് ചെയ്യൂ', mn: 'Бүх файлыг үнэгүй хөрвүүлээрэй', mr: 'सर्व फाइल्स मोफत रूपांतरित करा',
  ms: 'Tukar Semua Fail Percuma', mt: "Ikkonverti l-fajls kollha b'xejn", my: 'ဖိုင်အားလုံးကို အခမဲ့ ပြောင်းပါ',
  nb: 'Konverter alle filer gratis', ne: 'सबै फाइलहरू निःशुल्क रूपान्तरण गर्नुहोस्', nl: 'Converteer alle bestanden gratis',
  pa: 'ਸਾਰੀਆਂ ਫ਼ਾਈਲਾਂ ਮੁਫ਼ਤ ਕਨਵਰਟ ਕਰੋ', pl: 'Konwertuj wszystkie pliki za darmo', ps: 'ټول فایلونه وړیا بدل کړئ',
  'pt-BR': 'Converta todos os arquivos grátis', 'pt-PT': 'Converta todos os ficheiros grátis', ro: 'Convertește toate fișierele gratuit',
  ru: 'Конвертируйте все файлы бесплатно', rw: 'Hindura dosiye zose ku buntu', si: 'සියලු ගොනු නොමිලේ පරිවර්තනය කරන්න',
  sk: 'Konvertujte všetky súbory zadarmo', sl: 'Pretvorite vse datoteke brezplačno', so: 'Beddel dhammaan faylasha bilaash',
  sq: 'Konverto të gjithë skedarët falas', sr: 'Konvertujte sve fajlove besplatno', su: 'Konvérsi Sadaya File Gratis',
  sv: 'Konvertera alla filer gratis', sw: 'Badilisha faili zote bure', ta: 'அனைத்து கோப்புகளையும் இலவசமாக மாற்றுங்கள்',
  te: 'అన్ని ఫైల్‌లను ఉచితంగా మార్చండి', tg: 'Ҳама файлҳоро ройгон табдил диҳед', th: 'แปลงไฟล์ทั้งหมดฟรี',
  tk: 'Ähli faýllary mugt öwüriň', tl: 'I-convert ang Lahat ng File nang Libre', tr: 'Tüm Dosyaları Ücretsiz Dönüştürün',
  uk: 'Конвертуйте всі файли безкоштовно', ur: 'تمام فائلیں مفت کنورٹ کریں', uz: 'Barcha fayllarni bepul o‘zgartiring',
  vi: 'Chuyển Đổi Mọi Tệp Miễn Phí', xh: 'Guqula zonke iifayile simahla', yo: 'Yí gbogbo fáìlì padà lọ́fẹ̀ẹ́',
  'zh-CN': '免费转换所有文件', 'zh-TW': '免費轉換所有檔案', zu: 'Guqula wonke amafayela mahhala',
};

const dir = resolve('public/i18n');
const files = readdirSync(dir).filter((file) => file.endsWith('.json'));
for (const file of files) {
  const code = file.slice(0, -5);
  if (!titles[code]) throw new Error(`Missing translated title for ${code}`);
  const path = resolve(dir, file);
  const strings = JSON.parse(readFileSync(path, 'utf8'));
  strings['meta.title'] = `I Need Convert - ${titles[code]}`;
  writeFileSync(path, `${JSON.stringify(strings, null, 2)}\n`);
}

if (files.length !== Object.keys(titles).length) {
  throw new Error(`Locale count mismatch: ${files.length} files, ${Object.keys(titles).length} titles`);
}
console.log(`Updated ${files.length} localized titles.`);
