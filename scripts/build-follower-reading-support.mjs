#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const workspace = resolve(process.cwd(), "..");
const supportRoot = resolve(process.cwd(), "curriculum-support");

const languageNotes = {
  arabic: {
    normal: "The Arabic lines are in Modern Standard Arabic. The vowel marks show short vowels and case endings, so read every marked vowel instead of guessing from the bare consonants.",
    expert: "The reading uses fully vocalized Modern Standard Arabic. Lexical citation forms follow the established perfect-stem convention for verbs, while the learner text preserves the attested inflected form and case vocalization."
  },
  french: {
    normal: "Read the French aloud in short groups. Learn each noun with its article because the article helps you remember gender.",
    expert: "The examples use contemporary standard French with informal singular tu. Article-bearing citation forms preserve lexical gender, including explicit gender marking where elision hides it."
  },
  german: {
    normal: "German nouns begin with capital letters. Learn each noun with der, die, or das, and watch where the finite verb goes in each sentence.",
    expert: "The reading uses contemporary standard German. Noun citation forms retain nominative gender articles, while running text shows the case forms required by syntax."
  },
  hindi: {
    normal: "Read the Devanagari from left to right and keep the final verb or है form with its clause. आप is the polite way to address the other person in this block.",
    expert: "The examples use contemporary standard Hindi in Devanagari. Postpositions follow their hosts, predicates are clause-final, and agreement is described only where the reading supplies direct evidence."
  },
  japanese: {
    normal: "Use the readings in the line-by-line help for unfamiliar kanji. Read the Japanese sentence first, then check the natural English meaning.",
    expert: "The reading uses standard polite です／ます style with discourse-supported argument omission. Kana readings identify the attested lexical forms without replacing the Japanese script."
  },
  korean: {
    normal: "Read each Hangul block as one syllable. Particles stay attached to the word before them, but the breakdown explains what each particle does.",
    expert: "The examples use standard Korean in the informal-polite 해요 style. Particle allomorphy and contractions are analyzed as grammar while lexical entries retain citation forms."
  },
  russian: {
    normal: "Keep Cyrillic as the main text. In the reading help, an acute accent marks the stressed vowel; the accent is a study mark and is not normally written in everyday Russian.",
    expert: "The support uses Cyrillic with a single acute accent on the stressed vowel of polysyllabic content words. It introduces no romanization and leaves monosyllables unmarked unless contrast requires it."
  },
  spanish: {
    normal: "Read the Spanish punctuation with the sentence: ¿ starts a question and ¡ starts an exclamation. Learn nouns with el or la when an article is shown.",
    expert: "The reading uses broadly intelligible contemporary Spanish with tú as neutral informal singular address. Null subjects and article-bearing citation forms are analyzed only where attested."
  },
  thai: {
    normal: "Thai normally has no spaces between every word. Use the Thai-script word groups in the breakdown to find the parts, but keep the original sentence as your main reading.",
    expert: "The support segments the attested Thai script for reading assistance without romanization or invented tone notation. Polite particles and classifier syntax remain part of the grammatical analysis."
  },
  zulu: {
    normal: "Read the joined isiZulu word as a whole, then use the explanation to notice its noun-class or subject-concord parts. Do not remove a concord from a sentence just because the English translation has no matching word.",
    expert: "The analysis treats concord-bearing surface words as morphosyntactic occurrences. Noun citation forms retain their noun-class prefix, and verbs retain the infinitive uku- citation form in lexical records."
  }
};

const curricula = {
  arabic: {
    core: "arabic-core",
    chapters: ["chapter-001-greetings-and-identity", "chapter-002-layla-s-room", "chapter-003-what-is-this", "chapter-004-sami-s-morning", "chapter-005-a-cafe-plan"],
    lessons: [
      ["أَنَا + N", "a first meeting", "Use [[grammar:أَنَا]] before a name or role noun to say who you are. Arabic has no present-tense word for ‘am’ in this pattern. In أَنَا طَالِبَةٌ, طَالِبَةٌ is the role. Do not add an Arabic word for ‘am’.", "This is a first-person verbless nominal clause: أَنَا is the subject and the following nominative nominal is the predicate. Natural English supplies ‘am,’ but the Arabic present clause has zero copula."],
      ["فِي + place", "a description of Layla’s room", "Put [[grammar:فِي]] before a place to mean ‘in.’ In فِي الْغُرْفَةِ مَكْتَبٌ, الْغُرْفَةِ is the place and مَكْتَبٌ is what is there. Do not put فِي after the place.", "The preposition فِي heads a locative prepositional phrase and assigns genitive case to الْغُرْفَةِ. The postposed indefinite مَكْتَبٌ is the nominative theme of the verbless existential clause."],
      ["مَا هَذَا؟ / مَا هَذِهِ؟", "questions about nearby objects", "Use [[grammar:مَا هَذَا؟]] for a masculine item and [[grammar:مَا هَذِهِ؟]] for a feminine item. Match هَذَا or هَذِهِ to the noun in the answer. Do not use the same demonstrative for every noun.", "Interrogative مَا combines with a gender-agreeing proximal demonstrative in a verbless identification question. هَلْ in the yes–no example is separate supporting question grammar, not another lexical sense."],
      ["يَفْعَلُ + subject", "Sami’s morning routine", "A present verb can come before the person doing the action. In يَشْرَبُ سَامِي مَاءً, [[grammar:يَشْرَبُ سَامِي]] means ‘Sami drinks.’ Keep the verb matched to the subject; do not treat سَامِي as the object.", "The chapter supplies elementary VSO clauses with third-person masculine singular imperfect verbs. In يَشْرَبُ سَامِي مَاءً, سَامِي is the nominative postverbal subject and مَاءً the accusative object."],
      ["أُرِيدُ + N", "Layla and Sami’s café plan", "Use [[grammar:أُرِيدُ]] before the thing you want. In أُرِيدُ قَهْوَةً, the speaker wants coffee. Do not use the third-person verb form when you mean ‘I want.’", "أُرِيدُ is a first-person singular imperfect transitive verb with an accusative noun-phrase complement. وَأَنَا adds a coordinated topic, while نَذْهَبُ is a separately inflected occurrence of the already tracked verb ذَهَبَ."]
    ]
  },
  french: {
    core: "french-core",
    chapters: ["chapter-001-meeting-a-neighbor", "chapter-002-breakfast-in-the-apartment", "chapter-003-do-you-like-tea", "chapter-004-a-walk-nearby", "chapter-005-going-to-the-market"],
    lessons: [
      ["Je suis + N", "Lina and Marc meeting as neighbors", "Use [[grammar:Je suis]] before your name or role. Je suis étudiante means ‘I am a student.’ Profession nouns usually have no article here, so do not say Je suis une étudiante for this simple role statement.", "The clause contains subject clitic je, first-person singular finite copula suis, and a nominal predicate. Profession predicates normally occur without a determiner; lexical gender remains visible in the citation form."],
      ["Il y a + N", "breakfast in Lina’s apartment", "Use [[grammar:Il y a]] to say something is present. Dans la cuisine, il y a une table means there is a table in the kitchen. Keep all three words together; do not translate il as a real person here.", "Il y a is an impersonal existential construction. A fronted locative phrase sets the spatial frame, and the following usually indefinite noun phrase introduces the entity."],
      ["Tu aimes + N ?", "a conversation about general likes", "Use [[grammar:Tu aimes]] plus a food or drink to ask one familiar person what they like. Tu aimes le thé ? asks about tea in general. For a general plural category, say j’aime les pommes, not j’aime la pomme.", "The informal singular subject clitic tu combines with finite aimes and a direct-object noun phrase. Rising intonation marks the polar question; generic food preferences use the definite article, with plural les pommes for apples as a category."],
      ["près de + N", "Lina walking through Marc’s neighborhood", "Use [[grammar:près de]] before the second place to say the first place is near it. La boulangerie est près du parc means the bakery is near the park. Remember that de + le becomes du.", "The complex preposition près de selects a noun-phrase complement. Masculine singular de + le contracts obligatorily to du, while près de la maison shows the uncontracted feminine article."],
      ["On va + infinitif", "a plan to shop at the market", "Use [[grammar:On va]] followed by an infinitive for a shared plan. On va acheter des tomates means ‘We are going to buy tomatoes.’ Do not confuse this with on va au marché, where au marks a destination.", "Conversational on has first-person plural reference. Finite va plus a bare infinitive forms the aller periphrasis; va au marché instead contains the contracted destination phrase à + le."]
    ]
  },
  german: {
    core: "german-core",
    chapters: ["chapter-001-new-neighbors", "chapter-002-in-the-kitchen", "chapter-003-where-is-the-key", "chapter-004-jonas-in-the-morning", "chapter-005-a-plan-for-today"],
    lessons: [
      ["Ich bin + N", "Mia and Jonas meeting as neighbors", "Use [[grammar:Ich bin]] before your name or role. Ich bin Studentin means ‘I am a student.’ A profession has no article here, so do not add eine before Studentin.", "The clause contains nominative subject ich, first-person singular finite copula bin, and a nominal predicate. Profession nouns are bare in this predicative use while retaining lexical gender."],
      ["in + Dativ", "a description of the kitchen", "Use [[grammar:in + dative]] for a place where something stays. In der Küche means ‘in the kitchen.’ Die Küche changes to der Küche here; do not keep die after in for this location.", "The two-way preposition in selects dative for static location. Feminine die Küche therefore surfaces as der Küche, while the following nominative theme controls the finite verb."],
      ["Wo ist + N?", "Mia asking where belongings are", "Use [[grammar:Wo ist]] before one thing to ask where it is. Wo ist das Handy? asks for a location. Use Was ist das? for identity, so do not swap wo and was.", "Locative interrogative wo occupies the first field, finite ist occupies the second, and the nominative subject follows. This is a regular V2 content question."],
      ["main-clause verb-second", "Jonas’s morning routine", "In a German statement, one complete part comes first and the [[grammar:finite verb]] comes second. In Morgens ist Jonas in der Küche, Morgens is first and ist is second. The first part may be the subject or an adverb, so do not always put the verb after the subject.", "Main-clause V2 places exactly one constituent in the Vorfeld and the finite verb in the left bracket; Morgens ist, Dann liest, and Danach gehen demonstrate adverbial-first V2, while Er trinkt shows subject-first V2."],
      ["finite verb + subject", "a yes–no question about today’s plan", "Start a yes–no question with the [[grammar:finite verb]], then put the subject next. Gehen wir heute in den Park? asks whether the plan is true. Do not use statement order when no question word is present.", "The polar question has an unoccupied first field and finite gehen in initial position, followed by nominative wir. This V1 order contrasts with the V2 declaratives elsewhere in the dialogue."]
    ]
  },
  hindi: {
    core: "hindi-core",
    chapters: ["chapter-001-polite-introductions", "chapter-002-a-room-at-home", "chapter-003-what-is-this", "chapter-004-rina-s-morning", "chapter-005-a-market-plan"],
    lessons: [
      ["मैं + N + हूँ", "Rina and Amit introducing themselves", "Put [[grammar:मैं]] first and [[grammar:हूँ]] at the end to say who you are. मैं छात्रा हूँ means ‘I am a female student.’ Match the role noun to the person; do not drop हूँ in this polite full sentence.", "This first-person singular copular clause has subject मैं, a gender-sensitive nominal predicate, and agreement-bearing copula हूँ in clause-final position."],
      ["N + में + N + है", "a description of Rina’s room", "Put [[grammar:में]] after the place and [[grammar:है]] at the end. कमरे में एक मेज़ है means there is a table in the room. Do not put में before the place as you would put English ‘in.’", "The postposition में follows an oblique nominal host. The locative phrase precedes the nominative theme, and singular copula है closes the existential clause."],
      ["यह क्या है?", "questions about nearby belongings", "Use [[grammar:यह क्या है?]] to ask ‘What is this?’ Keep है at the end. यह फ़ोन है? is a yes–no question from context, so do not treat every क्या as the same kind of question marker.", "Demonstrative यह is the subject, interrogative nominal क्या the predicate, and copula है clause-final. The location question कहाँ है is a separate interrogative structure in the reading."],
      ["feminine subject + ती है", "Rina’s morning routine", "With one feminine subject, a habitual verb often ends in [[grammar:ती है]]. रीना चाय पीती है says what Rina usually does. Do not use the masculine form पीता है for Rina.", "The habitual participle agrees feminine singular with रीना, while auxiliary है carries present tense. The masculine अमित example and plural दोनों example show contrasting agreement outside the canonical identity."],
      ["क्या आप + place + चलेंगे?", "a polite market plan", "Use [[grammar:क्या आप ... चलेंगे?]] to politely ask if someone will go somewhere. क्या आप आज बाज़ार चलेंगे? addresses one person respectfully. Do not translate the opening क्या as ‘what’ in this yes–no question.", "Clause-initial क्या marks a polar question. Honorific आप triggers plural/honorific future agreement in चलेंगे; the reply हम फल खरीदेंगे reinforces future planning without introducing the necessity construction हमें + infinitive + है."]
    ]
  },
  japanese: {
    core: "japanese-core",
    chapters: ["chapter-001-a-first-meeting", "chapter-002-a-quiet-room", "chapter-003-what-is-this", "chapter-004-at-the-cafe", "chapter-005-an-invitation"],
    lessons: [
      ["N + です", "Aki and Yuki meeting for the first time", "Put [[grammar:です]] after a name or role for a polite identity statement. ゆきです。教師です。 means ‘I’m Yuki. I’m a teacher.’ Japanese can leave out ‘I’ when it is clear, so do not add 私 to every line.", "The polite copular predicate consists of a nominal plus です, with the discourse subject omitted. 教師 is appropriate self-occupation vocabulary; 先生 remains appropriate for address or reference to another teacher. よろしくお願いします carries a relationship-opening pragmatic meaning rather than a literal request alone."],
      ["place + に + N + があります", "a description of a quiet room", "Put [[grammar:に]] after the place and [[grammar:があります]] after an inanimate thing. 机の横にいすがあります means there is a chair beside the desk. Do not use います for these objects.", "Locative に marks the site, nominative が the theme, and polite existential あります selects an inanimate subject. Relative nouns such as 上 and 横 form the locative phrase with の."],
      ["これは何ですか", "questions about nearby belongings", "Use [[grammar:これは何ですか]] to politely ask what a nearby thing is. は marks これ as the topic and か marks the question. Do not omit か in this full polite pattern.", "The topic phrase これ + は precedes interrogative nominal 何 and polite copula です; final か marks interrogative force. 鍵はどこですか is a parallel topic question with a locative interrogative."],
      ["N + を + verb", "Aki and Yuki eating and reading at a café", "Put [[grammar:を]] after the thing directly affected by the action, then put the verb at the end. 本を読みます means ‘read a book.’ A common mistake is to put を after the person doing the action.", "Object particle を marks the direct object of polite nonpast predicates such as 飲みます, 食べます, and 読みます. 本を読みます has a discourse-supported omitted subject and no overt location adjunct."],
      ["place + へ + 行きませんか", "an invitation to the park", "Use [[grammar:へ行きませんか]] after a place to invite someone to go there. 明日、公園へ行きませんか is a gentle invitation. Read へ as え here, and do not translate the negative form as a simple refusal.", "Destination particle へ precedes polite negative interrogative 行きませんか, conventionally interpreted as an invitation. The affirmative 行きます in the response and later plan retains the same motion predicate."]
    ]
  },
  korean: {
    core: "korean-core",
    chapters: ["chapter-001-a-polite-first-meeting", "chapter-002-a-room-at-home", "chapter-003-what-is-this", "chapter-004-minji-s-morning", "chapter-005-going-out-together"],
    lessons: [
      ["N은/는 — topic marking", "Minji and Junho meeting politely", "Put [[grammar:은]] after a consonant sound and [[grammar:는]] after a vowel sound to mark the topic. 저는 is 저 + 는. Structural gloss: ‘as for me.’ Natural English: ‘I.’ Do not translate 은/는 as a separate English word every time.", "은/는 marks a discourse topic in topic–comment structure, with phonologically conditioned allomorphy. 저는 decomposes as 저 + 는; the copula separately alternates between 이에요 and 예요."],
      ["place + 에 + N + 이/가 있어요", "a description of a room at home", "Put [[grammar:에]] after the place and [[grammar:이/가 있어요]] after the thing that is there. 책상 옆에 의자가 있어요 means there is a chair beside the desk. Do not use this pattern to describe an action happening at a place.", "Locative 에 marks the site, nominative 이/가 the theme, and informal-polite 있어요 the existential predicate. Particle selection follows the preceding coda."],
      ["이게 뭐예요?", "questions about nearby belongings", "Use [[grammar:이게 뭐예요?]] to politely ask what a nearby thing is. 이게 is the spoken contraction of 이것이: [[grammar:이것이 → 이게]]. Keep the dictionary headword 이것; do not learn the subject particle as part of the noun.", "The surface subject 이게 contracts from 이것이, combining demonstrative 이것 with nominative 이. Interrogative 뭐 precedes polite copula 예요; contraction belongs to the grammatical occurrence, not the lexical identity."],
      ["N + 을/를 + verb", "Minji and Junho’s morning routine", "Put [[grammar:을]] after a consonant-ending object and [[grammar:를]] after a vowel-ending object, then put the verb at the end. 밥을 먹어요 means ‘eat a meal.’ Do not put the object particle on the person doing the action.", "Object-particle allomorphy is coda-conditioned: 을 follows consonant-final 밥 and 책, while 를 follows vowel-final 커피 and 가방. Informal-polite predicates remain clause-final."],
      ["같이 + place + 에 가요", "Minji and Junho planning an outing", "Use [[grammar:같이]] with a destination marked by [[grammar:에 가요]] to suggest going together. 오늘 공원에 같이 가요 means ‘Let’s go to the park together today.’ Do not use 에 for the person accompanying you.", "Adverb 같이 modifies the motion event, destination 에 marks 공원 or 카페, and informal-polite 가요 closes the clause. The proposal reading arises pragmatically without a separate imperative form."]
    ]
  },
  russian: {
    core: "russian-core",
    chapters: ["chapter-001-meeting-at-home", "chapter-002-anna-s-room", "chapter-003-where-is-the-key", "chapter-004-ivan-s-morning", "chapter-005-a-walk-today"],
    lessons: [
      ["Я + N", "Anna and Ivan meeting at home", "Put [[grammar:Я]] before your name or role to say who you are. Я студентка means ‘I am a female student.’ Russian normally has no present-tense word for ‘am’ here, so do not add one.", "This is a present-tense zero-copula nominal clause. Predicate role nouns agree with the referent’s natural gender; contrastive а in А я преподаватель links the second identity."],
      ["в + предложный падеж", "a description of Anna’s room", "Use [[grammar:в]] with the location form of a noun to mean ‘in.’ В комнате means ‘in the room’; комната changes to комнате. Do not keep the dictionary ending after в in this location.", "For static location, preposition в selects the prepositional case. Existential есть introduces a present entity, while находится lexically predicates location."],
      ["Где + N?", "Anna asking where belongings are", "Use [[grammar:Где]] before a thing to ask where it is. Где телефон? asks for a location. Что это? asks what something is, so do not swap где and что.", "Locative interrogative adverb где forms a verbless present location question. The replies use prepositional location phrases на столе and в сумке."],
      ["subject + verb + object", "Ivan and Anna’s morning", "A basic statement can put the person first, the action second, and the object third. Иван ест хлеб follows this order. Russian word order can change with context, so use this as a clear starting pattern, not an unbreakable rule.", "The reading supplies neutral SVO clauses with present-tense agreement and accusative direct objects. Inanimate masculine хлеб is syncretic between nominative and accusative."],
      ["Мы идём + в + place", "a neutral plan to walk to the park", "Use [[grammar:Мы идём в]] before a destination for a current one-way trip on foot. Мы сегодня идём в парк? puts сегодня in a neutral early position. Do not use идём for every kind of repeated or vehicle travel.", "First-person plural идём is the imperfective determinate motion verb. Destination в парк selects accusative, and Мы сегодня идём в парк? has unmarked temporal placement for the planned-today context."]
    ]
  },
  spanish: {
    core: "spanish-core",
    chapters: ["chapter-001-meeting-a-neighbor", "chapter-002-breakfast-at-home", "chapter-003-what-is-this", "chapter-004-luis-in-the-morning", "chapter-005-a-market-plan"],
    lessons: [
      ["Soy + N", "Ana and Luis meeting as neighbors", "Use [[grammar:Soy]] before your name or role. Soy estudiante means ‘I am a student.’ Spanish can leave out yo because soy already shows who speaks; do not add an article before the simple profession role.", "Finite copula soy encodes first-person singular agreement and licenses a null subject. Bare profession predicates agree for grammatical gender where their form varies."],
      ["Hay + N", "breakfast in Ana’s kitchen", "Use [[grammar:Hay]] to say something exists or is present. En la cocina hay una mesa means there is a table in the kitchen. Hay does not change for one or many things, so do not make it plural.", "Invariant existential hay introduces an indefinite noun phrase. A fronted locative phrase sets the spatial frame without changing the existential predicate."],
      ["¿Qué es esto?", "questions about nearby belongings", "Use [[grammar:¿Qué es esto?]] to ask what a nearby thing is. Keep the written accent on qué and both question marks. Do not use dónde when you want identity rather than location.", "Interrogative pronoun qué bears an accent and precedes finite copula es plus neutral demonstrative esto. The location question ¿Dónde está la llave? instead selects estar."],
      ["subject + verb + object", "Luis and Ana’s morning routine", "A simple statement can put a subject, verb, and object in that order. After Luis is clear, También come pan leaves the subject out. Do not repeat the subject pronoun in every Spanish sentence.", "Present verbs encode person and number. An overt lexical subject establishes discourse reference, allowing subsequent null subjects while direct objects follow the finite verb."],
      ["Vamos a + infinitivo", "a shared plan for the market", "Use [[grammar:Vamos a]] plus an infinitive for a shared near-future plan. Vamos a comprar fruta means ‘We are going to buy fruit.’ Do not confuse it with vamos al mercado, where al marks a destination.", "First-person plural vamos plus a and infinitive forms the periphrastic future. Destination al is the contraction of a + el and does not introduce an infinitive."]
    ]
  },
  thai: {
    core: "thai-core",
    chapters: ["chapter-001-a-polite-meeting", "chapter-002-one-quiet-room", "chapter-003-what-is-this", "chapter-004-mali-s-morning", "chapter-005-a-market-plan"],
    lessons: [
      ["ชื่อ + name + ครับ/ค่ะ", "Mali and Non meeting politely", "Use [[grammar:ชื่อ + name]] to give your name. End the statement with [[grammar:ครับ]] for Non or [[grammar:ค่ะ]] for Mali in this dialogue. Do not swap ครับ and ค่ะ between these speakers.", "Thai omits the recoverable first-person subject. ชื่อ functions predicatively with the name, while sex-indexed polite final particles ครับ and ค่ะ mark stance and speaker presentation."],
      ["N + numeral + classifier", "counting the things in Mali’s room", "Put the noun first, the number next, and the right [[grammar:classifier]] last. หนังสือหนึ่งเล่ม means ‘one book.’ Use เล่ม for the book and ตัว for furniture; do not copy one classifier for every noun.", "The chapter uses noun–numeral–classifier order. The selected classifiers are lexically conditioned: ห้อง for rooms, ตัว for furniture, เล่ม for books, and แก้ว for a serving vessel of water."],
      ["นี่คืออะไร", "questions about nearby belongings", "Use [[grammar:นี่คืออะไร]] to ask what a nearby thing is. คือ identifies the thing, and คะ makes Mali’s question polite. Do not use เป็น for this object-identification question.", "Proximal demonstrative นี่ precedes identifying copula คือ and interrogative อะไร. Role classification uses เป็น; yes–no ไหม and polite คะ are supporting particles in other lines."],
      ["subject + verb + object", "Mali and Non’s morning routine", "Thai usually puts the action before its object, and the verb does not change for the subject. มาลีกินข้าว has Mali, then ‘eat,’ then ‘rice/meal.’ A clear subject may be left out, but do not leave it out when the reader cannot tell who acts.", "The analytic clauses use ordinary SVO order with uninflected predicates and discourse-supported subject omission. Temporal ตอนเช้า frames the first event, and ที่บ้าน is a postverbal location phrase."],
      ["ไป + place + กันไหม", "Mali and Non planning a market trip", "Use [[grammar:ไป ... กันไหม]] to suggest going somewhere together. วันนี้ไปตลาดกันไหมครับ asks about going to the market today. In the answer ซื้อผลไม้ที่ตลาดครับ, the object follows ซื้อ and the place follows it; do not front ที่ตลาด in this subjectless reply.", "Motion ไป plus destination, inclusive กัน, and polar particle ไหม forms the proposal. The reply uses an omitted discourse subject with ซื้อ + direct object ผลไม้ + locative adjunct ที่ตลาด, followed by polite ครับ."]
    ]
  },
  zulu: {
    core: "zulu-core",
    chapters: ["chapter-001-meeting-thandi", "chapter-002-thandi-s-home", "chapter-003-where-is-the-key", "chapter-004-thandi-s-morning", "chapter-005-a-shared-plan"],
    lessons: [
      ["ngi- + ngu- + N", "Thandi and Sipho introducing themselves", "Use [[grammar:ngi- + ngu-]] with a name or role to say ‘I am ...’. Ngingumfundi means ‘I am a student.’ The pieces join into one written word, so do not separate ngi and ngu with spaces.", "First-person singular subject concord ngi- combines with identifying copulative ngu- before a vowel-initial noun. The resulting phonological word is written conjunctively."],
      ["noun + class concord + adjective", "a description of Thandi’s home", "The describing part must match the noun class. Ikhaya ... [[grammar:lincane]] means ‘the home is small,’ with li- matching ikhaya. Do not reuse li- with every noun class.", "Class 5 ikhaya controls the class 5 predicative descriptive concord in lincane. Concord-bearing predicates such as iphezu and siseduze remain learner-facing word forms whose occurrences are mapped to their lexical descriptions."],
      ["class concord + kuphi?", "a direct search for a pen and key", "Join the right noun-class concord to [[grammar:kuphi]] to ask where something is. Likuphi ipeni? asks about class 5 ipeni, while Ukuphi ukhiye? asks about class 3 ukhiye. The answer must locate the item asked about.", "Locative interrogative stem -phi combines with class agreement: li- in likuphi and u- in ukuphi. Ukhiye useduze nesikhwama preserves class 3 subject concord u- and directly locates ukhiye."],
      ["u- + verb stem", "Thandi and Sipho’s morning routine", "Use subject marker [[grammar:u-]] on a present verb with one class 1 person such as uThandi. UThandi uphuza itiye means Thandi drinks tea. A common mistake is to separate u- from the verb in writing.", "Class 1 subject concord u- appears on present indicative predicates uphuza, udla, ufunda, and uphatha with class 1 human subjects."],
      ["asi- + verb stem", "Thandi and Sipho making a shared plan", "Use [[grammar:asi-]] with the verb form to suggest ‘let’s ...’. Asihambe manje means ‘Let’s go now.’ The place forms emakethe and epaki are locative occurrences; learn the nouns as imakethe and ipaki.", "The inclusive first-person plural hortative combines a- with subject marker si- and subjunctive morphology in asihambe. Locative e- plus noun-class morphology yields surface emakethe and epaki from citation nouns imakethe and ipaki."]
    ]
  }
};

const grammarPrefixes = {
  arabic: "ARA",
  french: "FRA",
  german: "GER",
  hindi: "HIN",
  japanese: "JPN",
  korean: "KOR",
  russian: "RUS",
  spanish: "SPA",
  thai: "THA",
  zulu: "ZUL"
};

const russianStress = [
  ["Здра́вствуйте", "Приве́т", "А́нна", "Ива́н", "студе́нтка", "преподава́тель"],
  ["ко́мната А́нны", "ко́мната нахо́дится в до́ме", "В ко́мнате есть стол", "На столе́ лежи́т кни́га", "Ря́дом стои́т стул", "В ко́мнате есть окно́"],
  ["Что э́то", "Э́то ру́чка", "Где телефо́н", "Телефо́н на столе́", "А где ключ", "Ключ в су́мке"],
  ["У́тром ку́хня ти́хая", "На столе́ вода́", "Ива́н ест хлеб", "А́нна пьёт чай", "Она́ чита́ет кни́гу", "Пото́м они́ выхо́дят из до́ма"],
  ["Мы сего́дня идём в парк", "Да, идём вме́сте", "Парк ря́дом с до́мом", "Пото́м мы идём в кафе́", "Хорошо́, встре́тимся в три", "Да, до встре́чи"]
];

function extractReading(markdown) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex((line) => /^### (?:Dialogue|Narrative)$/u.test(line.trim()));
  if (start < 0) throw new Error("missing reading heading");
  const endOffset = lines.slice(start + 1).findIndex((line) => /^### /u.test(line.trim()));
  const section = lines.slice(start + 1, endOffset < 0 ? lines.length : start + 1 + endOffset);
  let cursor = 0;
  while (cursor < section.length && section[cursor].trim() === "") cursor += 1;
  while (cursor < section.length && section[cursor].trim() !== "") cursor += 1;
  while (cursor < section.length && section[cursor].trim() === "") cursor += 1;
  return section.slice(cursor).filter((line) => line.trim() !== "").map((line) => line.replace(/^[^:]+:\s*/u, "").trim());
}

function translationLines(value) {
  if (Array.isArray(value.turns)) return value.turns.map((item) => item.text);
  if (Array.isArray(value.sentences)) return value.sentences.map((item) => item.text);
  throw new Error(`${value.id}: unsupported translation shape`);
}

function buildBreakdown(lines, translations, pattern, language) {
  if (lines.length !== translations.length) throw new Error(`${language}: reading/translation count mismatch ${lines.length}/${translations.length}`);
  const normalLead = `Read each exact ${language} line, then check its natural English meaning. Watch for [[grammar:${pattern}]] where it appears.`;
  const expertLead = `These exact reading lines provide the distributional evidence for [[grammar:${pattern}]]. The grammar section above analyzes the relevant morphology and syntax.`;
  const bullets = lines.map((line, index) => `- ${line} — ${translations[index]}`);
  return {
    normal: `${normalLead}\n\n${bullets.join("\n")}`,
    expert: `${expertLead}\n\n${bullets.join("\n")}`
  };
}

for (const [language, config] of Object.entries(curricula)) {
  for (let index = 0; index < config.chapters.length; index += 1) {
    const chapter = config.chapters[index];
    const sourceRoot = join(workspace, `${language}-curriculum`, "units", config.core, chapter);
    const markdown = readFileSync(join(sourceRoot, "chapter.md"), "utf8");
    const translation = JSON.parse(readFileSync(join(sourceRoot, "reading-translation.en.json"), "utf8"));
    const lines = extractReading(markdown);
    const translations = translationLines(translation);
    const [pattern, situation, normalGrammar, expertGrammar] = config.lessons[index];
    const outputFile = join(supportRoot, language, `chapter-${String(index + 1).padStart(3, "0")}`, "reading-support.json");
    let previous = {};
    try { previous = JSON.parse(readFileSync(outputFile, "utf8")); } catch {}
    const output = {
      schemaVersion: 1,
      semanticRoleSyntaxVersion: 1,
      semanticSpanPolicyVersion: 1,
      sourcePath: "chapter.md",
      canonicalGrammarIds: [`${grammarPrefixes[language]}-GRAMMAR-${String(index + 1).padStart(3, "0")}`],
      audienceSections: [
        {
          sourceHeading: "Brief Introduction",
          normal: `In ${situation}, you will use [[grammar:${pattern}]]. ${normalGrammar}`,
          expert: `This chapter presents [[grammar:${pattern}]] in ${situation}. ${expertGrammar}`
        },
        {
          sourceHeading: "Grammar",
          normal: normalGrammar,
          expert: expertGrammar
        },
        {
          sourceHeading: "Language Notes",
          normal: languageNotes[language].normal,
          expert: languageNotes[language].expert
        }
      ],
      breakdown: buildBreakdown(lines, translations, pattern, language)
    };
    if (Array.isArray(previous.readingItems)) {
      output.readingItems = previous.readingItems.map((item, lineIndex) =>
        Object.hasOwn(item, "sourceText") ? { ...item, sourceText: lines[lineIndex] } : item
      );
    }
    if (language === "japanese" && index === 0) {
      output.readingItems = output.readingItems.map((item) => {
        if (item.lexicalEntryId === "ja.noun.sensei") {
          return { ...item, surface: "教師", reading: "きょうし", evidence: "ゆきです。教師です。", lexicalEntryId: "ja.noun.kyoushi", senseId: "ja.noun.kyoushi.teacher-occupation" };
        }
        if (item.lexicalEntryId === "ja.expression.yoroshiku-onegaishimasu") {
          return { ...item, senseId: "ja.expression.yoroshiku-onegaishimasu.relationship-opening-greeting" };
        }
        return item;
      });
    }
    if (language === "japanese" && index === 3) {
      output.readingItems = output.readingItems.map((item) =>
        item.lexicalEntryId === "ja.verb.yomu" ? { ...item, evidence: "本を読みます。" } : item
      );
    }
    if (language === "thai" && index === 4) {
      output.readingItems[2].wordBoundaryGuide = "ซื้อ ผลไม้ ที่ ตลาด ครับ.";
    }
    if (language === "russian") {
      output.readingItems = lines.map((sourceText, lineIndex) => ({ sourceText, stressedText: russianStress[index][lineIndex] }));
    }
    mkdirSync(dirname(outputFile), { recursive: true });
    const serialized = JSON.stringify(output, null, 2)
      .replace(/\[\[grammar:([^"\]\n]*?)([?؟.!。！？])\]\]/gu, "[[grammar:$1]]$2");
    writeFileSync(outputFile, `${serialized}\n`);
  }
}

console.log("Built 50 follower reading-support sidecars.");
