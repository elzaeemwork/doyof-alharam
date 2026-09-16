/**
 * منظومة ضيوف الحرم v2.0 - محرك المسح الذكي وقراءة الجوازات محلياً (Offline 100%)
 * معمارية هجينة ثنائية المسار (Dual-Pipeline Hybrid Fusion):
 * 1. مسار شريط الـ MRZ المعزول (English + Monospace + Whitelist)
 * 2. مسار البيانات الشخصية البصرية (VIZ) باللغتين العربية والإنجليزية
 * متوافق بالكامل مع الجوازات العراقية والعربية ومعايير ICAO 9303 والحزم التنفيذي (.exe / asarUnpack)
 */

const path = typeof require !== 'undefined' ? require('path') : null;
const fs = typeof require !== 'undefined' ? require('fs') : null;

// Weights for ICAO 9303 Check Digit algorithm
const ICAO_WEIGHTS = [7, 3, 1];

const IRAQI_PROVINCES = [
    'نينوى', 'بغداد', 'أربيل', 'دهوك', 'السليمانية', 'كركوك', 
    'صلاح الدين', 'الأنبار', 'بابل', 'كربلاء', 'النجف', 'البصرة', 
    'واسط', 'ميسان', 'ذي قار', 'المثنى', 'القادسية', 'ديالى'
];

const PROVINCE_MAP = {
    'نينوى': 'نينوى', 'ninawa': 'نينوى', 'nineveh': 'نينوى', 'الموصل': 'نينوى',
    'بغداد': 'بغداد', 'baghdad': 'بغداد',
    'أربيل': 'أربيل', 'اريل': 'أربيل', 'erbil': 'أربيل', 'arbil': 'أربيل', 'هه‌ولێر': 'أربيل',
    'السليمانية': 'السليمانية', 'sulaymaniyah': 'السليمانية', 'sulaimaniyah': 'السليمانية', 'سلێمانی': 'السليمانية',
    'دهوك': 'دهوك', 'duhok': 'دهوك', 'dohuk': 'دهوك',
    'كركوك': 'كركوك', 'kirkuk': 'كركوك',
    'البصرة': 'البصرة', 'basrah': 'البصرة', 'basra': 'البصرة',
    'النجف': 'النجف', 'najaf': 'النجف',
    'كربلاء': 'كربلاء', 'karbala': 'كربلاء',
    'بابل': 'بابل', 'babylon': 'بابل', 'الحلة': 'بابل',
    'صلاح الدين': 'صلاح الدين', 'salah al-din': 'صلاح الدين', 'تكريت': 'صلاح الدين',
    'الأنبار': 'الأنبار', 'anbar': 'الأنبار', 'الرمادي': 'الأنبار',
    'ديالى': 'ديالى', 'diyala': 'ديالى', 'بعقوبة': 'ديالى',
    'واسط': 'واسط', 'wasit': 'واسط', 'الكوت': 'واسط',
    'ميسان': 'ميسان', 'maysan': 'ميسان', 'العمارة': 'ميسان',
    'ذي قار': 'ذي قار', 'dhi qar': 'ذي قار', 'الناصرية': 'ذي قار',
    'المثنى': 'المثنى', 'muthanna': 'المثنى', 'السماوة': 'المثنى',
    'القادسية': 'القادسية', 'qadisiyah': 'القادسية', 'الديوانية': 'القادسية'
};

const EXCLUDED_WORDS = [
    // عبارات التوقيع
    'توقيع', 'توقع', 'حامل', 'الجواز', 'واژوی', 'واژەی', 'هه‌ڵگری', 'پاسپۆرت', 'signature', 'holder',
    // تسميات الحقول الإدارية
    'الاسم', 'الثلاثي', 'الرباعي', 'ناوی', 'سیانی', 'اللقب', 'نازناو', 'العشيرة', 'surname', 'given', 'names', 'full', 'name',
    'الجنسية', 'رەگەزنامە', 'رمكه', 'زنانه', 'nationality', 'sex', 'type', 'النوع', 'الرمز', 'الرقم',
    'اسم', 'الأم', 'الام', 'دایک', 'mother', 'moth', 'والدة',
    'محل', 'الميلاد', 'شوێنی', 'له دایک بوون', 'place', 'birth',
    'جهة', 'الإصدار', 'شوێنی ده‌رچوون', 'issuing', 'authority',
    'تاريخ', 'النفاذ', 'الانتهاء', 'الإصدار', 'رۆژی به سه‌رچوون', 'date', 'issue', 'expiry',
    'جمهورية', 'العراق', 'العراقية', 'كۆماری', 'كؤماری', 'كۆمارى', 'كؤمارى', 'كوماری', 'كومارى', 'عیراق', 'عێراق', 'عراق', 'republic', 'iraq',
    'وزارة', 'الداخلية', 'مديرية', 'الإقامة', 'شؤون', 'السلطة', 'المهنة', 'الملاحظات', 'التوقيع', 'الدولة', 'بطاقة', 'وطنية', 'specimen'
];

const COUNTRY_MAP = {
    'IRQ': 'عراقي',
    'SAU': 'سعودي',
    'SYR': 'سوري',
    'JOR': 'أردني',
    'EGY': 'مصري',
    'LBN': 'لبناني',
    'TUR': 'تركي',
    'KWT': 'كويتي',
    'ARE': 'إماراتي',
    'QAT': 'قطري',
    'BHR': 'بحريني',
    'OMN': 'عماني',
    'YEM': 'يمني'
};

function getCharValue(c) {
    if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
    if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 65 + 10;
    if (c >= 'a' && c <= 'z') return c.charCodeAt(0) - 97 + 10;
    return 0; // '<' or other characters
}

function calculateCheckDigit(str) {
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
        sum += getCharValue(str[i]) * ICAO_WEIGHTS[i % 3];
    }
    return sum % 10;
}

function verifyCheckDigit(dataStr, checkDigitChar) {
    if (!checkDigitChar || checkDigitChar === '<') return true;
    const expected = calculateCheckDigit(dataStr);
    return expected === parseInt(checkDigitChar, 10);
}

function parseMRZDate(yymmdd, isExpiry = false) {
    if (!yymmdd || yymmdd.length !== 6) return '';
    const yy = parseInt(yymmdd.substring(0, 2), 10);
    const mm = yymmdd.substring(2, 4);
    const dd = yymmdd.substring(4, 6);
    
    const currentYearShort = new Date().getFullYear() % 100;
    let fullYear;
    if (isExpiry) {
        fullYear = (yy <= 70) ? 2000 + yy : 1900 + yy;
    } else {
        fullYear = (yy <= currentYearShort) ? 2000 + yy : 1900 + yy;
    }
    return `${fullYear}-${mm}-${dd}`;
}

function isValidISODate(d) {
    return typeof d === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d) && !d.includes('<') && !d.includes('NaN');
}

/**
 * Parses raw text looking for MRZ lines (44 characters each, Doc 9303)
 */
function extractMRZFromLines(lines) {
    const cleaned = lines
        .map(l => l.replace(/[^A-Z0-9<]/g, '').trim())
        .filter(l => l.length >= 18);

    let mrz1 = '';
    let mrz2 = '';

    for (let i = 0; i < cleaned.length; i++) {
        const line = cleaned[i];
        if (line.startsWith('P<') || (line.startsWith('P') && line.includes('<<'))) {
            mrz1 = line;
            if (i + 1 < cleaned.length) {
                mrz2 = cleaned[i + 1];
            }
            break;
        }
    }

    if (!mrz2) {
        for (let i = 0; i < cleaned.length; i++) {
            const line = cleaned[i];
            if (/^[A-Z0-9]{7,10}[0-9]/.test(line) || /[0-9]{6}[0-9][MF<][0-9]{6}/.test(line)) {
                mrz2 = line;
                if (i > 0 && cleaned[i - 1].includes('<')) {
                    mrz1 = cleaned[i - 1];
                }
                break;
            }
        }
    }

    if (!mrz1 && !mrz2) return null;

    mrz1 = (mrz1 || '').padEnd(44, '<').substring(0, 44);
    mrz2 = (mrz2 || '').padEnd(44, '<').substring(0, 44);

    const docType = mrz1[0];
    let countryCode = mrz1.substring(2, 5);
    if (countryCode === '1RQ' || countryCode === 'LRQ') countryCode = 'IRQ';

    // Name parts
    const namePart = mrz1.substring(5);
    const nameParts = namePart.split('<<');
    const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
    const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
    const englishFullName = `${surname} ${givenNames}`.replace(/\s+/g, ' ').trim();

    // Passport number
    let passportRaw = mrz2.substring(0, 9);
    // Sanitize common OCR mistake: O instead of 0 in numeric digits
    let passportNo = passportRaw.replace(/</g, '').trim();
    if (/^[A-Za-z][A-Za-z0-9]+$/.test(passportNo)) {
        const prefix = passportNo[0];
        const body = passportNo.substring(1).replace(/[Oo]/g, '0').replace(/[Ii]/g, '1');
        passportNo = prefix.toUpperCase() + body;
        passportRaw = passportNo.padEnd(9, '<');
    }
    const passportCheck = mrz2[9];
    let isPassportValid = verifyCheckDigit(passportRaw, passportCheck);

    // Self-repair check: if first char is 8, in Iraq Series A it's often 'A'
    if (!isPassportValid && passportNo.startsWith('8') && passportNo.length >= 8) {
        const testCandidate = 'A' + passportNo.substring(1);
        if (verifyCheckDigit(testCandidate.padEnd(9, '<'), passportCheck)) {
            passportNo = testCandidate;
            isPassportValid = true;
        }
    }

    // Nationality
    let nationalityCode = mrz2.substring(10, 13);
    if (nationalityCode === '1RQ' || nationalityCode === 'LRQ') nationalityCode = 'IRQ';
    const nationality = COUNTRY_MAP[nationalityCode] || (nationalityCode === 'IRQ' ? 'عراقي' : 'أخرى');

    // Date of birth
    const dobRaw = mrz2.substring(13, 19);
    const dobCheck = mrz2[19];
    const isDobValid = verifyCheckDigit(dobRaw, dobCheck);
    const birthDate = parseMRZDate(dobRaw, false);

    // Sex
    const sexChar = mrz2[20];
    let gender = 'ذكر';
    if (sexChar === 'F') gender = 'أنثى';
    else if (sexChar === 'M') gender = 'ذكر';

    // Expiry date
    const expiryRaw = mrz2.substring(21, 27);
    const expiryCheck = mrz2[27];
    const isExpiryValid = verifyCheckDigit(expiryRaw, expiryCheck);
    const expiryDate = parseMRZDate(expiryRaw, true);

    const allChecksumsValid = isPassportValid && isDobValid && isExpiryValid;

    return {
        found: true,
        docType,
        countryCode,
        surname,
        givenNames,
        englishFullName,
        passportNo,
        isPassportValid,
        nationalityCode,
        nationality,
        birthDate: isValidISODate(birthDate) ? birthDate : '',
        isDobValid,
        gender,
        expiryDate: isValidISODate(expiryDate) ? expiryDate : '',
        isExpiryValid,
        allChecksumsValid
    };
}

/**
 * Extracts and auto-corrects dates from Visual Inspection Zone (VIZ)
 */
function extractVIZDates(text) {
    const dates = [];
    const dateRegex = /\b(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4})\b/g;
    let match;
    while ((match = dateRegex.exec(text)) !== null) {
        let dStr = match[1].replace(/[/.]/g, '-');
        let parts = dStr.split('-');
        let standardDate = '';
        if (parts[0].length === 4) {
            let yr = parts[0];
            // Fix OCR misreads on 19XX: 4977 -> 1977, 7980 -> 1980, 3977 -> 1977
            if (yr.startsWith('49') || yr.startsWith('79') || yr.startsWith('39')) {
                yr = '19' + yr.substring(2);
            }
            standardDate = `${yr}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
            let yr = parts[2];
            if (yr.startsWith('49') || yr.startsWith('79') || yr.startsWith('39')) {
                yr = '19' + yr.substring(2);
            }
            standardDate = `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        if (standardDate && !dates.includes(standardDate)) {
            const yr = parseInt(standardDate.substring(0, 4), 10);
            if (yr >= 1920 && yr <= 2040) {
                dates.push(standardDate);
            }
        }
    }
    return dates;
}

/**
 * Extracts Iraqi Passport Number from Visual Inspection Zone (VIZ)
 */
function extractVIZPassportNo(text) {
    // 1. Direct Iraqi passport number match: A or B followed by 7-8 digits
    const directMatch = text.match(/\b([AB][0-9]{7,8})\b/i);
    if (directMatch) return directMatch[1].toUpperCase();

    // 2. Misread '8' instead of 'A' (e.g. 817252721 -> A17252721)
    const lines = text.split('\n');
    for (const line of lines) {
        if (/passport|جواز|رقم/i.test(line) || /[0-9]{8}/.test(line)) {
            const m = line.match(/\b([8][0-9]{7,8})\b/);
            if (m) return 'A' + m[1].substring(1);
        }
    }
    return '';
}

/**
 * Extracts Province / Governorate (Arabic and English resolution)
 */
function extractProvince(text) {
    const lower = text.toLowerCase();
    for (const [key, prov] of Object.entries(PROVINCE_MAP)) {
        if (lower.includes(key.toLowerCase())) {
            return prov;
        }
    }
    return '';
}

function cleanArabicNamePart(str) {
    if (!str) return '';
    let clean = str;
    for (const term of EXCLUDED_WORDS) {
        if (!term) continue;
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`(?:^|[\\s:،.-])${escaped}(?=[\\s:،.-]|$)`, 'gi');
        clean = clean.replace(reg, ' ');
    }
    // Support all Arabic and Kurdish letters in the Arabic Unicode block
    clean = clean.replace(/[^\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return clean;
}

/**
 * Extracts Arabic Biodata (Full name, surname, province, mother's name) from OCR text
 */
function extractArabicBiodata(rawText) {
    const rawLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    let givenName = '';
    let surname = '';
    let motherName = '';

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        
        // 1. Given Name Anchor
        if (/الاسم|ناوی|سیانی|Full\s*N[oa]me|Given/i.test(line) && !/الأم|الام|دایک|حامل|توقيع|توقع/i.test(line)) {
            let val = cleanArabicNamePart(line);
            if ((!val || val.length < 3) && i + 1 < rawLines.length) {
                val = cleanArabicNamePart(rawLines[i + 1]);
            }
            if (val && val.length >= 3 && !givenName) {
                givenName = val;
            }
        }

        // 2. Surname Anchor
        if (/اللقب|نازناو|Surname|العشيرة/i.test(line)) {
            let val = cleanArabicNamePart(line);
            if ((!val || val.length < 2) && i + 1 < rawLines.length) {
                val = cleanArabicNamePart(rawLines[i + 1]);
            }
            if (val && val.length >= 2 && !surname) {
                surname = val;
            }
        }

        // 3. Mother Name Anchor
        if (/الأم|الام|دایک|Mother\b|Moth\b/i.test(line)) {
            let val = cleanArabicNamePart(line);
            if ((!val || val.length < 3) && i + 1 < rawLines.length) {
                val = cleanArabicNamePart(rawLines[i + 1]);
            }
            if (val && val.length >= 3 && !motherName) {
                motherName = val;
            }
        }
    }

    // Direct fallback search if given name not isolated cleanly:
    if (!givenName) {
        for (const line of rawLines) {
            const clean = cleanArabicNamePart(line);
            const words = clean.split(' ').filter(w => w.length >= 2);
            if (words.length >= 2 && words.length <= 4 && !clean.includes('توقيع') && !clean.includes('حامل')) {
                givenName = clean;
                break;
            }
        }
    }

    let fullName = '';
    if (givenName && surname) {
        if (!givenName.includes(surname)) {
            fullName = `${givenName} ${surname}`.trim();
        } else {
            fullName = givenName.trim();
        }
    } else if (givenName) {
        fullName = givenName.trim();
    }

    fullName = cleanArabicNamePart(fullName);

    return {
        fullName,
        motherName: cleanArabicNamePart(motherName),
        province: extractProvince(rawText)
    };
}

/**
 * Helper to crop the bottom MRZ band of an image
 * Works in both Electron (Node main process) and Browser (Canvas)
 */
function cropMRZBand(imageSource) {
    try {
        if (typeof require !== 'undefined') {
            try {
                const { nativeImage } = require('electron');
                if (nativeImage) {
                    let img;
                    if (Buffer.isBuffer(imageSource)) {
                        img = nativeImage.createFromBuffer(imageSource);
                    } else if (typeof imageSource === 'string' && imageSource.startsWith('data:image')) {
                        const raw = imageSource.replace(/^data:image\/\w+;base64,/, '');
                        img = nativeImage.createFromBuffer(Buffer.from(raw, 'base64'));
                    } else if (typeof imageSource === 'string' && fs && fs.existsSync(imageSource)) {
                        img = nativeImage.createFromPath(imageSource);
                    }
                    if (img && !img.isEmpty()) {
                        const size = img.getSize();
                        const mrzHeight = Math.round(size.height * 0.20);
                        const cropped = img.crop({
                            x: 0,
                            y: size.height - mrzHeight,
                            width: size.width,
                            height: mrzHeight
                        });
                        return cropped.toJPEG(95);
                    }
                }
            } catch (eNative) {}
        }
    } catch (eCrop) {}
    return imageSource;
}

/**
 * Singleton Offline Tesseract Workers
 */
let _tesseractEngWorker = null;
let _tesseractMultiWorker = null;
let _isWorkerInitializing = false;

function resolveUnpacked(p) {
    if (!p) return p;
    if (p.includes('app.asar') && !p.includes('app.asar.unpacked')) {
        const unp = p.replace('app.asar', 'app.asar.unpacked');
        if (fs && fs.existsSync(unp)) return unp;
    }
    return p;
}

function getTesseractLibrary() {
    let Tesseract = null;
    let tesseractError = null;

    try {
        Tesseract = require('tesseract.js');
    } catch (e) {
        tesseractError = e;
        if (typeof process !== 'undefined' && process.resourcesPath) {
            try {
                const unpNodeModules = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'tesseract.js');
                if (fs && fs.existsSync(unpNodeModules)) {
                    Tesseract = require(unpNodeModules);
                }
            } catch (e2) {
                tesseractError = e2;
            }
        }
    }

    if (!Tesseract && typeof window !== 'undefined' && window.Tesseract) {
        Tesseract = window.Tesseract;
    }

    if (!Tesseract) {
        throw new Error('محرك Tesseract غير متوفر: ' + (tesseractError ? tesseractError.message : 'غير معروف'));
    }

    return Tesseract;
}

function getTessdataPath() {
    let langPath = null;
    if (typeof process !== 'undefined' && process.resourcesPath) {
        const candidateRes = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'ocr', 'tessdata');
        if (fs && fs.existsSync(candidateRes)) langPath = candidateRes;
    }
    if (!langPath && typeof __dirname !== 'undefined' && path && fs) {
        const candidate1 = resolveUnpacked(path.join(__dirname, 'tessdata'));
        const candidate2 = resolveUnpacked(path.resolve(process.cwd(), 'assets', 'ocr', 'tessdata'));
        if (fs.existsSync(candidate1)) langPath = candidate1;
        else if (fs.existsSync(candidate2)) langPath = candidate2;
    }
    if (!langPath && path && typeof path.resolve === 'function') {
        langPath = resolveUnpacked(path.resolve('assets/ocr/tessdata'));
    }
    if (!langPath) {
        langPath = 'assets/ocr/tessdata';
    }
    return langPath;
}

async function getWorkers(onProgress) {
    if (_tesseractEngWorker && _tesseractMultiWorker) {
        return { engWorker: _tesseractEngWorker, multiWorker: _tesseractMultiWorker };
    }

    if (_isWorkerInitializing) {
        while (_isWorkerInitializing) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (_tesseractEngWorker && _tesseractMultiWorker) {
            return { engWorker: _tesseractEngWorker, multiWorker: _tesseractMultiWorker };
        }
    }

    _isWorkerInitializing = true;
    try {
        const Tesseract = getTesseractLibrary();
        const langPath = getTessdataPath();

        if (onProgress) onProgress({ status: 'تهيئة محرك القراءة المحلي المزدوج...', progress: 0.1 });

        const isBrowser = typeof window !== 'undefined' && (!fs || typeof process === 'undefined' || !process.versions || !process.versions.electron);

        const options = {
            langPath: langPath,
            gzip: true
        };

        if (isBrowser) {
            options.workerPath = 'assets/ocr/worker.min.js';
            options.corePath = 'assets/ocr/tesseract-core-simd-lstm.wasm.js';
        }

        // Worker 1: English-only for MRZ with OCR-B whitelist
        _tesseractEngWorker = await Tesseract.createWorker(['eng'], 1, options);
        await _tesseractEngWorker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
            tessedit_pageseg_mode: '6'
        });

        // Worker 2: Arabic + English for Visual Inspection Zone (VIZ)
        _tesseractMultiWorker = await Tesseract.createWorker(['ara', 'eng'], 1, options);

        return { engWorker: _tesseractEngWorker, multiWorker: _tesseractMultiWorker };
    } finally {
        _isWorkerInitializing = false;
    }
}

/**
 * Main Public Scanner Function
 * Executes Dual-Pipeline Zonal Extraction and Intelligent Fusion
 */
async function scanPassportImageFile(imageSource, onProgress) {
    if (onProgress) onProgress({ status: 'جارٍ تجهيز وتحسين جودة الصورة...', progress: 0.1 });

    let fullImageInput = imageSource;
    let base64Preview = '';

    // Handle base64 string
    if (typeof imageSource === 'string' && imageSource.startsWith('data:image')) {
        base64Preview = imageSource;
        if (typeof Buffer !== 'undefined') {
            const raw = imageSource.replace(/^data:image\/\w+;base64,/, '');
            fullImageInput = Buffer.from(raw, 'base64');
        }
    } else if (typeof imageSource === 'string' && fs && fs.existsSync(imageSource)) {
        fullImageInput = fs.readFileSync(imageSource);
        base64Preview = 'data:image/jpeg;base64,' + fullImageInput.toString('base64');
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(imageSource)) {
        fullImageInput = imageSource;
        base64Preview = 'data:image/jpeg;base64,' + imageSource.toString('base64');
    }

    if (onProgress) onProgress({ status: 'تشغيل محرك القراءة المحلي (بدون إنترنت)...', progress: 0.2 });
    const { engWorker, multiWorker } = await getWorkers(onProgress);

    // 1. Pipeline A: Dedicated Zonal MRZ Scan
    if (onProgress) onProgress({ status: 'قراءة وفحص شريط القراءة الآلية (MRZ)...', progress: 0.35 });
    const mrzCropInput = cropMRZBand(fullImageInput);
    let mrzData = null;
    try {
        const retMrz = await engWorker.recognize(mrzCropInput);
        const mrzLines = (retMrz.data.text || '').split('\n');
        mrzData = extractMRZFromLines(mrzLines);
    } catch (eMrz) {
        console.warn('MRZ crop scan notice:', eMrz);
    }

    // 2. Pipeline B: Full Image Arabic + Multilingual Scan
    if (onProgress) onProgress({ status: 'قراءة وتدقيق البيانات الشخصية بالعربية...', progress: 0.6 });
    let rawMultiText = '';
    try {
        const retMulti = await multiWorker.recognize(fullImageInput);
        rawMultiText = retMulti.data.text || '';
    } catch (eMulti) {
        console.warn('Multilingual scan error:', eMulti);
    }

    // Fallback: If MRZ wasn't detected in crop, try extracting from full text
    if (!mrzData || !mrzData.found) {
        mrzData = extractMRZFromLines(rawMultiText.split('\n')) || {
            found: false,
            passportNo: '',
            birthDate: '',
            expiryDate: '',
            gender: 'ذكر',
            nationality: 'عراقي',
            englishFullName: '',
            allChecksumsValid: false
        };
    }

    if (onProgress) onProgress({ status: 'مطابقة وتدقيق البيانات الحسابية والصريحة...', progress: 0.85 });

    // Extract VIZ Fallback Data
    const arabicBio = extractArabicBiodata(rawMultiText);
    const vizDates = extractVIZDates(rawMultiText);
    const vizPassportNo = extractVIZPassportNo(rawMultiText);

    // 3. Intelligent Data Fusion & Validation
    // Passport Number:
    let finalPassportNo = '';
    if (mrzData && mrzData.passportNo && /^[AB][0-9]{7,8}$/i.test(mrzData.passportNo)) {
        finalPassportNo = mrzData.passportNo.toUpperCase();
    } else if (vizPassportNo) {
        finalPassportNo = vizPassportNo;
    } else if (mrzData && mrzData.passportNo) {
        finalPassportNo = mrzData.passportNo.toUpperCase();
    }

    // Birth Date:
    let finalBirthDate = (mrzData && isValidISODate(mrzData.birthDate)) ? mrzData.birthDate : '';
    if (!finalBirthDate && vizDates.length > 0) {
        const bDate = vizDates.find(d => {
            const yr = parseInt(d.substring(0, 4), 10);
            return yr >= 1930 && yr <= 2015;
        });
        if (bDate) finalBirthDate = bDate;
    }

    // Expiry Date:
    let finalExpiryDate = (mrzData && isValidISODate(mrzData.expiryDate)) ? mrzData.expiryDate : '';
    if (!finalExpiryDate && vizDates.length > 0) {
        const expDate = vizDates.find(d => {
            const yr = parseInt(d.substring(0, 4), 10);
            return yr >= 2024 && yr <= 2040;
        });
        if (expDate) finalExpiryDate = expDate;
    }

    // Full Name:
    let finalFullName = '';
    if (arabicBio.fullName && arabicBio.fullName.length >= 4 && !arabicBio.fullName.includes('جمهورية') && !arabicBio.fullName.includes('كؤمار') && !arabicBio.fullName.includes('كۆمار')) {
        finalFullName = arabicBio.fullName;
    } else if (mrzData && mrzData.englishFullName) {
        finalFullName = mrzData.englishFullName;
    }

    // Nationality:
    let finalNationality = 'عراقي';
    if (mrzData && mrzData.nationality && mrzData.nationality !== 'أخرى') {
        finalNationality = mrzData.nationality;
    } else if (/عراق|عراقي|iraq/i.test(rawMultiText)) {
        finalNationality = 'عراقي';
    }

    const result = {
        success: true,
        fullName: finalFullName,
        arabicNameFound: !!(arabicBio.fullName && arabicBio.fullName.length >= 4),
        motherName: arabicBio.motherName || '',
        passportNo: finalPassportNo,
        birthDate: finalBirthDate,
        expiryDate: finalExpiryDate,
        gender: mrzData.gender || 'ذكر',
        nationality: finalNationality,
        province: arabicBio.province || '',
        englishName: mrzData.englishFullName || '',
        mrzFound: !!mrzData.found,
        isPassportValid: !!mrzData.isPassportValid,
        isDobValid: !!mrzData.isDobValid,
        isExpiryValid: !!mrzData.isExpiryValid,
        allChecksumsValid: !!mrzData.allChecksumsValid,
        processedImageBase64: base64Preview,
        rawOcrText: rawMultiText
    };

    if (onProgress) onProgress({ status: 'اكتملت القراءة والتدقيق بنجاح!', progress: 1.0 });

    return result;
}

async function terminateWorkers() {
    try {
        if (_tesseractEngWorker) {
            await _tesseractEngWorker.terminate();
            _tesseractEngWorker = null;
        }
        if (_tesseractMultiWorker) {
            await _tesseractMultiWorker.terminate();
            _tesseractMultiWorker = null;
        }
    } catch (e) {
        console.warn('Worker terminate error:', e);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        scanPassportImageFile,
        extractMRZFromLines,
        extractArabicBiodata,
        extractVIZDates,
        extractVIZPassportNo,
        parseMRZDate,
        calculateCheckDigit,
        verifyCheckDigit,
        terminateWorkers
    };
}
if (typeof window !== 'undefined') {
    window.PassportScanner = {
        scanPassportImageFile,
        extractMRZFromLines,
        extractArabicBiodata,
        extractVIZDates,
        extractVIZPassportNo,
        parseMRZDate,
        calculateCheckDigit,
        verifyCheckDigit,
        terminateWorkers
    };
}
