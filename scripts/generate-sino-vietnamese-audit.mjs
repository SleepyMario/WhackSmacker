import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const curriculumRoot = join(root, "..", "vietnamese-curriculum");
const supportRoot = join(root, "curriculum-support", "vietnamese");
const checkOnly = process.argv.includes("--check");

const definitions = [
  ["vi.noun.sinh-vien.university-student", "生員", [["sinh", "生"], ["viên", "員"]]],
  ["vi.noun.hoc-sinh.student", "學生", [["học", "學"], ["sinh", "生"]]],
  ["vi.noun.giao-vien.teacher", "教員", [["giáo", "教"], ["viên", "員"]]],
  ["vi.noun.nhan-vien-van-phong.office-worker", "人員文房", [["nhân", "人"], ["viên", "員"], ["văn", "文"], ["phòng", "房"]]],
  ["vi.noun.sach.book", "冊", [["sách", "冊"]], "The modern book sense continues the established reading of 冊."],
  ["vi.noun.but.pen", "筆", [["bút", "筆"]], "The modern pen sense is broader than the historical writing-brush sense of 筆."],
  ["vi.noun.ban.desk", "盤", [["bàn", "盤"]], "The modern desk or table sense reflects semantic development from a board or tray."],
  ["vi.noun.phong-hoc.classroom-room", "房學", [["phòng", "房"], ["học", "學"]]],
  ["vi.noun.dien-thoai.telephone", "電話", [["điện", "電"], ["thoại", "話"]]],
  ["vi.noun.tra.tea", "茶", [["trà", "茶"]]],
  ["vi.noun.tien.money", "錢", [["tiền", "錢"]]],
  ["vi.noun.ban-do.map", "版圖", [["bản", "版"], ["đồ", "圖"]]],
  ["vi.noun.cam.orange-fruit", "柑", [["cam", "柑"]], "This is the fruit sense of cam, not an orange-colour sense."],
  ["vi.noun.cong-vien.park", "公園", [["công", "公"], ["viên", "園"]]],
  ["vi.noun.thu-vien.library", "書院", [["thư", "書"], ["viện", "院"]], "Modern thư viện means library; 書院 historically denoted a book or learning institution."],
  ["vi.noun.truong.school", "場", [["trường", "場"]], "The modern school sense developed from the place or field reading of 場."],
  ["vi.noun.thanh-pho.city", "城舖", [["thành", "城"], ["phố", "舖"]]],
  ["vi.verb.thich.like", "適", [["thích", "適"]], "The modern everyday verb has broadened from the fitting or suitable sense of 適."],
  ["vi.noun.ho-chieu.passport", "護照", [["hộ", "護"], ["chiếu", "照"]]],
  ["vi.verb.chuan-bi.prepare", "準備", [["chuẩn", "準"], ["bị", "備"]]],
  ["vi.adjective.hoan-thanh.complete-finished", "完成", [["hoàn", "完"], ["thành", "成"]]],
  ["vi.noun.bai-tap.exercise-homework", "排習", [["bài", "排"], ["tập", "習"]], "The curriculum meaning is an exercise or homework task; the characters record the established Vietnamese constituent readings."],
  ["vi.noun.bao-cao.report", "報告", [["báo", "報"], ["cáo", "告"]]],
  ["vi.adjective.yen-tinh.quiet", "安靜", [["yên", "安"], ["tĩnh", "靜"]]],
  ["vi.noun.bao.newspaper", "報", [["báo", "報"]]],
  ["vi.noun.tap-chi.magazine", "雜誌", [["tạp", "雜"], ["chí", "誌"]]],
  ["vi.noun.thu.letter", "書", [["thư", "書"]], "Modern thư means a letter here; 書 has the broader historical field of writing and books."],
  ["vi.noun.truyen.story-fiction", "傳", [["truyện", "傳"]], "The reading truyện specializes the narrative or transmitted-account sense of 傳."],
  ["vi.adverb.can-than.carefully", "謹慎", [["cẩn", "謹"], ["thận", "慎"]]],
  ["vi.noun.buu-thiep.postcard", "郵帖", [["bưu", "郵"], ["thiếp", "帖"]]],
  ["vi.noun.dia-chi.address", "地址", [["địa", "地"], ["chỉ", "址"]]],
  ["vi.noun.so-dien-thoai.phone-number", "數電話", [["số", "數"], ["điện", "電"], ["thoại", "話"]]],
  ["vi.adjective.thu-vi.interesting", "趣味", [["thú", "趣"], ["vị", "味"]]],
  ["vi.noun.anh.photo-picture", "影", [["ảnh", "影"]]],
  ["vi.noun.chuong-trinh.program-show", "章程", [["chương", "章"], ["trình", "程"]], "Modern chương trình covers a program or show; 章程 historically refers to an ordered program or regulations."],
  ["vi.noun.truyen-hinh.television", "傳形", [["truyền", "傳"], ["hình", "形"]]],
  ["vi.noun.am-thanh.sound-audio", "音聲", [["âm", "音"], ["thanh", "聲"]]],
  ["vi.noun.nhac.music", "樂", [["nhạc", "樂"]]],
  ["vi.noun.giao-trinh.coursebook-textbook", "教程", [["giáo", "教"], ["trình", "程"]]],
  ["vi.noun.ngu-phap.grammar", "語法", [["ngữ", "語"], ["pháp", "法"]]],
  ["vi.noun.phat-am.pronunciation", "發音", [["phát", "發"], ["âm", "音"]]],
  ["vi.verb.hoc.study-learn", "學", [["học", "學"]]],
  ["vi.verb.luyen-tap.practice", "練習", [["luyện", "練"], ["tập", "習"]]],
  ["vi.verb.thu.try-on-try", "試", [["thử", "試"]]],
  ["vi.noun.quan.trousers-pants", "裙", [["quần", "裙"]], "Modern Vietnamese quần denotes trousers or pants; 裙 historically and in modern Chinese commonly denotes a skirt-like garment."],
  ["vi.noun.gia.price", "價", [["giá", "價"]]],
  ["vi.noun.hang-hoa.goods-merchandise", "行貨", [["hàng", "行"], ["hóa", "貨"]]],
  ["vi.noun.khach-hang.customer", "客行", [["khách", "客"], ["hàng", "行"]], "The modern Vietnamese compound means customer; the sequence records its Vietnamese constituents rather than a current Chinese word."],
  ["vi.verb.thanh-toan.pay-make-payment", "清算", [["thanh", "清"], ["toán", "算"]]],
  ["vi.noun.lich.schedule-calendar", "曆", [["lịch", "曆"]]],
  ["vi.noun.tai-lieu.document-material", "資料", [["tài", "資"], ["liệu", "料"]]],
  ["vi.adjective.an-toan.safe-secure", "安全", [["an", "安"], ["toàn", "全"]]],
  ["vi.verb.kiem-tra.check-inspect", "檢查", [["kiểm", "檢"], ["tra", "查"]]],
  ["vi.phrase.cam-on.thank-you", "感恩", [["cảm", "感"], ["ơn", "恩"]], "The everyday expression is lexicalized; the character sequence records its established Sino-Vietnamese constituents."],
  ["vi.noun.sach-tham-khao.reference-book", "冊參考", [["sách", "冊"], ["tham", "參"], ["khảo", "考"]]],
  ["vi.noun.thu-thu.librarian", "守書", [["thủ", "守"], ["thư", "書"]], "The sequence records the Vietnamese compound order and does not claim a current Chinese lexical form."],
  ["vi.noun.nguyen-lieu.ingredient", "原料", [["nguyên", "原"], ["liệu", "料"]]],
  ["vi.noun.ke-hoach.plan", "計劃", [["kế", "計"], ["hoạch", "劃"]]],
  ["vi.noun.bac-si.doctor", "博士", [["bác", "博"], ["sĩ", "士"]], "Modern Vietnamese bác sĩ means physician; 博士 historically means a learned scholar and now often a doctorate holder in other Sinitic contexts."],
  ["vi.particle.bi.be-affected-by-suffer-from", "被", [["bị", "被"]], "The modern Vietnamese affected or adverse marker continues the passive or affected field of 被."],
  ["vi.noun.du-an.project", "預案", [["dự", "預"], ["án", "案"]]],
  ["vi.noun.nhiem-vu.task", "任務", [["nhiệm", "任"], ["vụ", "務"]]],
  ["vi.verb.thu-thap.collect", "收拾", [["thu", "收"], ["thập", "拾"]]],
  ["vi.noun.dong-vat.animal", "動物", [["động", "動"], ["vật", "物"]]],
  ["vi.noun.tram-cuu-ho.rescue-center", "站救護", [["trạm", "站"], ["cứu", "救"], ["hộ", "護"]], "The sequence records Vietnamese compound order; modern Vietnamese denotes a rescue centre."],
  ["vi.particle.cac.plural-marker-for-an-identified-set", "各", [["các", "各"]], "The curriculum teaches the modern Vietnamese plural marker; 各 historically means each or every."],
  ["vi.verb.tinh-nguyen.volunteer", "情願", [["tình", "情"], ["nguyện", "願"]], "The modern volunteer sense develops from willingness or voluntary intent."],
  ["vi.conjunction.hoac.or", "或", [["hoặc", "或"]]],
  ["vi.noun.nong-san.produce-farm-product", "農產", [["nông", "農"], ["sản", "產"]]],
  ["vi.particle.tu.by-oneself-self", "自", [["tự", "自"]]],
  ["vi.noun.ban-huong-dan.guide-instruction-sheet", "本向引", [["bản", "本"], ["hướng", "向"], ["dẫn", "引"]], "The sequence records Vietnamese constituent order rather than a current Chinese lexical form."],
  ["vi.noun.buu-dien.post-office", "郵電", [["bưu", "郵"], ["điện", "電"]]],
  ["vi.noun.buu-kien.parcel", "郵件", [["bưu", "郵"], ["kiện", "件"]]],
  ["vi.noun.danh-muc.catalogue-index", "名目", [["danh", "名"], ["mục", "目"]]],
  ["vi.noun.muc-luc.table-of-contents", "目錄", [["mục", "目"], ["lục", "錄"]]],
  ["vi.noun.tac-gia.author", "作者", [["tác", "作"], ["giả", "者"]]],
  ["vi.noun.tieu-thuyet.novel", "小說", [["tiểu", "小"], ["thuyết", "說"]]],
  ["vi.verb.tra-cuu.look-up-consult", "查究", [["tra", "查"], ["cứu", "究"]]],
  ["vi.noun.du-bao.forecast", "預報", [["dự", "預"], ["báo", "報"]]],
  ["vi.noun.thoi-tiet.weather", "時節", [["thời", "時"], ["tiết", "節"]]],
  ["vi.noun.khu-vuc.area-zone", "區域", [["khu", "區"], ["vực", "域"]]],
  ["vi.noun.nhan-vien.staff-member-employee", "人員", [["nhân", "人"], ["viên", "員"]]],
  ["vi.noun.quy-dinh.rule-regulation", "規定", [["quy", "規"], ["định", "定"]]],
  ["vi.verb.dang-ky.register-sign-up", "登記", [["đăng", "登"], ["ký", "記"]]],
  ["vi.adjective.mien-phi.free-of-charge", "免費", [["miễn", "免"], ["phí", "費"]]],
  ["vi.adjective.truc-tuyen.online", "直線", [["trực", "直"], ["tuyến", "線"]], "Modern trực tuyến means online here; 直線 literally denotes a direct or straight line."],
  ["vi.conjunction.dong-thoi.at-the-same-time-simultaneously", "同時", [["đồng", "同"], ["thời", "時"]]],
  ["vi.noun.dich-vu.service", "役務", [["dịch", "役"], ["vụ", "務"]]],
  ["vi.verb.giai-thich.explain", "解釋", [["giải", "解"], ["thích", "釋"]]],
  ["vi.verb.ho-tro.support-assist", "互助", [["hỗ", "互"], ["trợ", "助"]]],
  ["vi.verb.huong-dan.guide-instruct", "向引", [["hướng", "向"], ["dẫn", "引"]], "The sequence records Vietnamese constituent order rather than a current Chinese lexical form."],
  ["vi.noun.so-luong.quantity-count", "數量", [["số", "數"], ["lượng", "量"]]],
  ["vi.numeral.khong.zero", "空", [["không", "空"]], "This is the numeral-zero sense. It is distinct from the Chapter 4 polarity particle, which is not canonicalized here."],
  ["vi.verb.kiem-ke.take-inventory-inventory-check", "檢稽", [["kiểm", "檢"], ["kê", "稽"]]],
  ["vi.classifier.quyen.classifier-for-books", "卷", [["quyển", "卷"]], "The modern Vietnamese classifier specializes the scroll or volume sense of 卷."],
  ["vi.noun.doi.team", "隊", [["đội", "隊"]]],
  ["vi.verb.tham-gia.participate", "參加", [["tham", "參"], ["gia", "加"]]],
  ["vi.conjunction.tuy-nhien.however", "雖然", [["tuy", "雖"], ["nhiên", "然"]]],
  ["vi.noun.kho.storeroom-stockroom", "庫", [["kho", "庫"]]],
  ["vi.adjective.du-phong.spare-backup", "預防", [["dự", "預"], ["phòng", "防"]], "Modern dự phòng means spare or backup here; 預防 more literally concerns advance guarding or prevention."],
  ["vi.classifier.ban.classifier-for-copies-or-versions", "本", [["bản", "本"]]],
  ["vi.noun.phieu.form-slip", "票", [["phiếu", "票"]]],
  ["vi.verb.in.print", "印", [["in", "印"]]],
  ["vi.verb.can.weigh", "斤", [["cân", "斤"]], "The verb to weigh develops from 斤 as a weight unit and the associated weighing sense."],
  ["vi.adverb.tong-cong.in-total", "總共", [["tổng", "總"], ["cộng", "共"]]],
  ["vi.noun.phan.share-portion", "分", [["phần", "分"]]],
  ["vi.adverb.trung-binh.on-average-average", "中平", [["trung", "中"], ["bình", "平"]]],
  ["vi.noun.bang-tong-ket.summary-table", "榜總結", [["bảng", "榜"], ["tổng", "總"], ["kết", "結"]], "The sequence records Vietnamese constituent order; modern Vietnamese means a summary table."],
  ["vi.verb.xac-nhan.confirm", "確認", [["xác", "確"], ["nhận", "認"]]]
];

const uncertain = new Map([
  ["vi.particle.khong.polarity", "The taught polarity senses are not equated with 空 merely because the surface reading matches."],
  ["vi.noun.bo.father-northern", "The Northern father term is not identified with unrelated Hán characters sharing the reading bố."],
  ["vi.noun.o.umbrella", "The umbrella sense is not an established Hán-Việt reading of 傘; same-sounding character readings are irrelevant."],
  ["vi.noun.tang.floor-storey", "tầng is a non-Sino-Vietnamese reading of 層 (Sino-Vietnamese tằng), so it is excluded."],
  ["vi.verb.can.need", "The everyday need sense is not identified with 勤 merely because cần is also a Hán-Việt reading."],
  ["vi.noun.hop.box", "The modern hộp form is not the canonical Hán-Việt reading of 盒 and is excluded from this Hán-Việt section."],
  ["vi.noun.dua-hau.watermelon", "A pedagogically secure whole-word Hán-Việt analysis was not established; folk decomposition is excluded."],
  ["vi.noun.pho.pho-noodle-soup", "Competing historical proposals make a character analysis unsuitable for this curriculum stage."],
  ["vi.noun.bun.rice-noodles", "The everyday form is not the canonical Hán-Việt reading of 粉; a theoretical historical link is insufficient."],
  ["vi.measure-word.lon.can-can-measure", "The container word is a modern Western loan, not a Hán-Việt lexical sense."],
  ["vi.particle.duoc.beneficial-affected", "được is not the canonical Hán-Việt reading đắc of 得; the taught particle is excluded."],
  ["vi.classifier.chiec.classifier-for-vehicles-and-selected-objects", "chiếc is not the canonical Hán-Việt reading chích of 隻; the classifier is excluded."],
  ["vi.noun.nuoc-khoang.mineral-water", "Only khoáng is Hán-Việt; a whole-word character sequence would mix native and Hán-Việt material without following the template."],
  ["vi.adjective.can-thiet.necessary", "The everyday cần constituent is not securely the required Hán-Việt morpheme; the compound is left uncertain."],
  ["vi.particle.tat-ca.all", "The mixed expression contains native cả; a whole-word Hán-Việt analysis would be misleading."]
]);

const modernLoans = new Set(["ba lô", "cà phê", "súp", "ga", "sạc", "email", "phim", "radio", "áo sơ mi", "áp phích", "tem", "xe buýt", "lon", "gam", "kilôgam", "lít", "mét", "xăng-ti-mét"]);
const properNames = new Set(["Hà Nội", "Việt Nam", "người Việt Nam"]);

const audit = JSON.parse(await readFile(join(curriculumRoot, "lexical-topic-audit.json"), "utf8"));
const canonical = new Map(audit.canonical_senses.map((record) => [record.sense_id, record]));
const records = [];
for (const [senseId, characters, constituentPairs, note] of definitions) {
  const source = canonical.get(senseId);
  if (source === undefined) throw new Error(`${senseId}: does not resolve to a canonical lexical sense`);
  if (constituentPairs.map((entry) => entry[1]).join("") !== characters) throw new Error(`${senseId}: constituent characters do not match whole-word characters`);
  const chapterSource = await readFile(join(curriculumRoot, source.provenance_path), "utf8");
  const section = chapterSource.match(/^### (?:Learner-facing )?(Dialogue|Narrative)$/mu)?.[0].replace(/^### /u, "");
  if (section === undefined || !source.examples.every((example) => chapterSource.includes(example))) throw new Error(`${senseId}: learner-facing evidence is absent`);
  const evidence = source.examples[0];
  records.push({
    record_id: `sv.${senseId}`,
    citation_form: source.citation_form.normalize("NFC"),
    canonical_lexical_id: source.lexical_id,
    canonical_sense_id: senseId,
    english_meaning: uniqueSemicolonMeaning(source.meaning),
    han_viet_reading_or_constituent_readings: constituentPairs.map(([reading]) => reading.normalize("NFC")),
    characters,
    constituents: constituentPairs.map(([reading, character], index) => ({ position: index + 1, reading: reading.normalize("NFC"), character })),
    first_introduced_chapter: source.first_introduction_chapter,
    chapter_attestations: [source.first_introduction_chapter],
    chapter_section_locator: `${source.provenance_path}#${section.toLowerCase().replaceAll(" ", "-")}`,
    literal_learner_facing_evidence: source.examples,
    attestation_records: [{ chapter: source.first_introduction_chapter, section, locator: `line containing: ${evidence}`, evidence }],
    modern_vietnamese_note: note ?? `The characters record the established Hán-Việt reading or constituent readings for the modern Vietnamese sense “${source.meaning}.”`,
    variant_identity: null,
    status: "canonical-established"
  });
}
records.sort((left, right) => left.first_introduced_chapter - right.first_introduced_chapter || left.canonical_sense_id.localeCompare(right.canonical_sense_id));

const constituentMap = new Map();
for (const record of records) for (const constituent of record.constituents) {
  const key = `${constituent.reading}\u0000${constituent.character}`;
  const current = constituentMap.get(key) ?? { morpheme_id: `sv.morpheme.${constituent.reading.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}.${constituent.character.codePointAt(0).toString(16).toUpperCase()}`, reading: constituent.reading, character: constituent.character, lexical_sense_ids: [] };
  current.lexical_sense_ids.push(record.canonical_sense_id);
  constituentMap.set(key, current);
}
const constituentMorphemes = [...constituentMap.values()].sort((left, right) => left.reading.localeCompare(right.reading) || left.character.localeCompare(right.character));

const eligibleIds = new Set(records.map((record) => record.canonical_sense_id));
const candidateAudit = audit.canonical_senses.map((source) => {
  if (eligibleIds.has(source.sense_id)) return { canonical_sense_id: source.sense_id, citation_form: source.citation_form, first_chapter: source.first_introduction_chapter, disposition: "eligible-established", reason: "Included with a pedagogically useful established Hán-Việt analysis." };
  if (uncertain.has(source.sense_id)) return { canonical_sense_id: source.sense_id, citation_form: source.citation_form, first_chapter: source.first_introduction_chapter, disposition: "uncertain-excluded", reason: uncertain.get(source.sense_id) };
  if (modernLoans.has(source.citation_form)) return { canonical_sense_id: source.sense_id, citation_form: source.citation_form, first_chapter: source.first_introduction_chapter, disposition: "rejected-modern-non-chinese-loan", reason: "English, French, or another modern non-Chinese loan is outside the Hán-Việt inventory." };
  if (properNames.has(source.citation_form)) return { canonical_sense_id: source.sense_id, citation_form: source.citation_form, first_chapter: source.first_introduction_chapter, disposition: "rejected-proper-name", reason: "Proper names and name-containing expressions are not included solely because theoretical characters exist." };
  return { canonical_sense_id: source.sense_id, citation_form: source.citation_form, first_chapter: source.first_introduction_chapter, disposition: "rejected-native-mixed-or-unhelpful", reason: "No secure, whole-sense, pedagogically useful Hán-Việt analysis is recorded for this canonical curriculum sense." };
});

const byChapter = new Map();
for (const record of records) {
  const entries = byChapter.get(record.first_introduced_chapter) ?? [];
  entries.push(record);
  byChapter.set(record.first_introduced_chapter, entries);
}
const chaptersWithSections = [...byChapter.keys()].sort((a, b) => a - b);
const chaptersWithoutSections = Array.from({ length: 50 }, (_, index) => index + 1).filter((chapter) => !byChapter.has(chapter));

const lexicon = {
  schema_version: 1,
  language: "Vietnamese",
  language_code: "vi",
  audited_through_chapter: 50,
  normalization: "NFC",
  policy: {
    canonical_identity_basis: "lexical-sense-not-surface-form",
    proper_names_included_by_theoretical_characters: false,
    speculative_etymologies_canonical: false,
    modern_vietnamese_written_normally_in_quoc_ngu: true,
    whole_word_records_distinct_from_constituent_morphemes: true
  },
  records,
  constituent_morphemes: constituentMorphemes
};

const sinoAudit = {
  schema_version: 1,
  language: "Vietnamese",
  audited_through_chapter: 50,
  canonical_template: {
    authority_chapters: [1, 2, 3],
    storage: "curriculum-support/vietnamese/chapter-NNN/reading-support.json#characters",
    heading: "Sino-Vietnamese Vocabulary",
    table_columns: ["Word", "Characters", "Meaning", "Usage"],
    entry_fields: ["word", "characters", "meaning", "lexicalEntryId", "senseId", "firstIntroductionChapter", "usage", "provenance"],
    placement: "projected immediately after New Vocabulary when Characters is enabled",
    normal_projection: "characters.normal",
    expert_projection: "characters.expert",
    developer_projection: "both Normal and Expert",
    characters_off_projection: "section absent",
    chapter_markdown_embeds_section: false,
    ledger_records_section: false,
    cumulative_ledger_records_section: false,
    reading_translation_records_section: false,
    empty_sections_mandatory: false
  },
  summary: {
    canonical_senses_audited: audit.canonical_senses.length,
    eligible_unique_lexical_senses: records.length,
    unique_constituent_morphemes: constituentMorphemes.length,
    chapters_with_sections: chaptersWithSections.length,
    chapters_without_sections: chaptersWithoutSections.length,
    uncertain_excluded: candidateAudit.filter((record) => record.disposition === "uncertain-excluded").length,
    rejected: candidateAudit.filter((record) => record.disposition.startsWith("rejected-")).length
  },
  chapters_with_sections: chaptersWithSections,
  chapters_without_sections: chaptersWithoutSections,
  chapter_findings: Array.from({ length: 50 }, (_, index) => index + 1).map((chapter) => ({ chapter, eligible_sense_ids: (byChapter.get(chapter) ?? []).map((record) => record.canonical_sense_id), section_required: byChapter.has(chapter) })),
  candidate_audit: candidateAudit,
  rejected_and_uncertain_candidates: candidateAudit.filter((record) => record.disposition !== "eligible-established"),
  identity_findings: [
    "cam fruit (柑) is canonical and distinct from any orange-colour sense; no orange-colour canonical sense occurs in Chapters 1-50.",
    "Chapter 4 polarity không remains excluded, while the distinct Chapter 41 numeral-zero sense is recorded as 空.",
    "tầng is excluded as a non-Sino-Vietnamese reading of 層; cân ‘weigh’ is included as a sense derived from 斤.",
    "Whole-word lexical records and reusable constituent morphemes have separate stable identities.",
    "No proper name is canonicalized solely from a theoretical character spelling."
  ],
  preservation: {
    learner_facing_content_changed: false,
    grammar_changed: false,
    lexical_topics_changed: false,
    review_eligibility_changed: false,
    review_cards_changed: false,
    package_identity_or_version_changed: false,
    chapter_51_created: false
  },
  reference_method: [
    { title: "Từ điển Hán Nôm", url: "https://hvdic.thivien.net/", use: "Established Hán-Việt readings, compounds, and character identities." },
    { title: "English Wiktionary Vietnamese entries", url: "https://en.wiktionary.org/wiki/Category:Vietnamese_terms_derived_from_Chinese", use: "Cross-checks for sense-specific etymology and non-Sino-Vietnamese readings." }
  ]
};

const markdown = renderAuditMarkdown(sinoAudit, lexicon);
await emit(join(curriculumRoot, "sino-vietnamese-lexicon.json"), `${JSON.stringify(lexicon, null, 2)}\n`);
await emit(join(curriculumRoot, "sino-vietnamese-audit.json"), `${JSON.stringify(sinoAudit, null, 2)}\n`);
await emit(join(curriculumRoot, "sino-vietnamese-audit.md"), markdown);

for (const chapter of [4, ...Array.from({ length: 45 }, (_, index) => index + 6)]) {
  const path = join(supportRoot, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json");
  const support = JSON.parse(await readFile(path, "utf8"));
  const chapterRecords = byChapter.get(chapter) ?? [];
  if (chapterRecords.length === 0) delete support.characters;
  else support.characters = renderSupportCharacters(chapterRecords);
  await emit(path, `${JSON.stringify(support, null, 2)}\n`);
}

function renderSupportCharacters(chapterRecords) {
  const rows = chapterRecords.map((record) => `| ${record.citation_form} | ${record.characters} | ${record.english_meaning} | \`${record.literal_learner_facing_evidence[0]}\` |`).join("\n");
  const table = `| Word | Characters | Meaning | Usage |\n|---|---|---|---|\n${rows}`;
  return {
    heading: "Sino-Vietnamese Vocabulary",
    normal: `${table}\n\nThe characters show established Hán-Việt word parts for vocabulary first introduced in this chapter. Keep using the modern Vietnamese spellings from the reading.`,
    expert: `${table}\n\nExpert context: the mappings record Vietnamese lexical history and constituent order, not a claim that modern Vietnamese writes these words in characters or that every sequence is a current Chinese lexical form.`,
    entries: chapterRecords.map((record) => ({
      word: record.citation_form,
      characters: record.characters,
      meaning: record.english_meaning,
      lexicalEntryId: record.canonical_lexical_id,
      senseId: record.canonical_sense_id,
      firstIntroductionChapter: record.first_introduced_chapter,
      usage: record.literal_learner_facing_evidence[0],
      provenance: {
        path: record.chapter_section_locator.split("#")[0],
        section: record.attestation_records[0].section,
        locator: record.attestation_records[0].locator
      }
    }))
  };
}

function renderAuditMarkdown(result, inventory) {
  const eligibleRows = result.chapter_findings.filter((chapter) => chapter.section_required).map((chapter) => `| ${chapter.chapter} | ${chapter.eligible_sense_ids.length} | ${chapter.eligible_sense_ids.map((id) => `\`${id}\``).join("<br>")} |`).join("\n");
  const uncertainRows = result.rejected_and_uncertain_candidates.filter((candidate) => candidate.disposition === "uncertain-excluded").map((candidate) => `| ${candidate.first_chapter} | \`${candidate.canonical_sense_id}\` | ${candidate.reason} |`).join("\n");
  return `# Vietnamese Sino-Vietnamese Audit — Chapters 1–50\n\n` +
    `This audit covers all ${result.summary.canonical_senses_audited} canonical lexical senses through Chapter 50. It records ${result.summary.eligible_unique_lexical_senses} eligible whole-word senses and ${result.summary.unique_constituent_morphemes} distinct constituent morphemes. No learner-facing vocabulary, dialogue, narrative, grammar, lexical-topic assignment, or Review card was changed.\n\n` +
    `## Canonical Chapters 1–3 format\n\nThe format is the \`characters\` object in each packaged \`reading-support.json\`: exact heading **Sino-Vietnamese Vocabulary**; Normal and Expert strings containing the four-column table **Word | Characters | Meaning | Usage**; and machine-readable entries with \`word\`, \`characters\`, \`meaning\`, \`lexicalEntryId\`, \`senseId\`, \`firstIntroductionChapter\`, \`usage\`, and \`provenance\`. The reader injects it immediately after **New Vocabulary** only when Characters is enabled. Normal shows the Normal text, Expert the Expert text, and Developer both. Chapters 1–3 do not embed the section in \`chapter.md\`, ledgers, cumulative ledgers, or translation sidecars, and do not establish mandatory empty sections.\n\n` +
    `## Chapters with eligible first-introduced senses\n\n| Chapter | Senses | Canonical sense IDs |\n|---:|---:|---|\n${eligibleRows}\n\n` +
    `Chapters audited without a section: ${result.chapters_without_sections.map((chapter) => `**${chapter}**`).join(", ")}.\n\n` +
    `## Identity and semantic findings\n\n${result.identity_findings.map((finding) => `- ${finding}`).join("\n")}\n\n` +
    `## Uncertain candidates excluded\n\n| Chapter | Sense | Reason |\n|---:|---|---|\n${uncertainRows}\n\n` +
    `The machine-readable audit lists every other rejected canonical sense and its rejection category. Modern English, French, and other non-Chinese loans, native or mixed expressions without a useful whole-sense analysis, speculative decompositions, and proper names with merely theoretical character forms are not canonical.\n\n` +
    `## Projection and continuity\n\nThe cumulative inventory keeps whole-word sense identity separate from ${inventory.constituent_morphemes.length} reusable morpheme identities. Sino-Vietnamese metadata is an additional dimension only: first-introduction chapters remain canonical, later reuse is not new vocabulary, lexical-topic metadata is untouched, and Review eligibility and membership remain inventory-derived. Chapter 50 remains present and Chapter 51 remains absent.\n`;
}

async function emit(path, content) {
  if (content !== content.normalize("NFC")) throw new Error(`${path}: output is not NFC-normalized`);
  if (checkOnly) {
    const current = await readFile(path, "utf8");
    if (current !== content) throw new Error(`${path}: stale; run node scripts/generate-sino-vietnamese-audit.mjs`);
  } else await writeFile(path, content);
}

function uniqueSemicolonMeaning(value) {
  return [...new Set(value.split(";").map((part) => part.trim()).filter(Boolean))].join("; ");
}
