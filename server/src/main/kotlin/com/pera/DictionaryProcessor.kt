package com.pera

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlText
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper
import com.fasterxml.jackson.dataformat.xml.XmlMapper
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty
import com.fasterxml.jackson.module.kotlin.readValue
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import kotlinx.serialization.Serializable
import java.io.File

@JsonIgnoreProperties(ignoreUnknown = true)
data class JMdict(
    @JacksonXmlElementWrapper(useWrapping = false)
    val entry: List<Entry>
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class Entry(
    val ent_seq: String,
    @JacksonXmlElementWrapper(useWrapping = false)
    val k_ele: List<Kanji>? = null,
    @JacksonXmlElementWrapper(useWrapping = false)
    val r_ele: List<Reading>? = null,
    @JacksonXmlElementWrapper(useWrapping = false)
    val sense: List<Sense>? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class Kanji(
    val keb: String
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class Reading(
    val reb: String,
    @JacksonXmlElementWrapper(useWrapping = false)
    val misc: List<String>? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class Sense(
    @JacksonXmlElementWrapper(useWrapping = false)
    val gloss: List<String>? = null,
    @JacksonXmlElementWrapper(useWrapping = false)
    val example: List<Example>? = null,
    @JacksonXmlElementWrapper(useWrapping = false)
    val stagr: List<String>? = null // Reading restriction
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class Example(
    val ex_text: String,
    val ex_text_ja: String
)

// Simplified output for the frontend
@Serializable
data class SimplifiedEntry(
    val ent_seq: String,
    val kanji: String?,
    val reading: String?,
    val meanings: List<MeaningDetail>, // Changed from List<String>
    val pitch: String?,
    val jlptLevel: String? = null // New field
)

@Serializable
data class MeaningDetail(
    val gloss: String,
    val gloss_cn: String? = null, // Chinese definition
    val examples: List<ExamplePair> = emptyList()
)

@Serializable
data class ExamplePair(
    val text: String,    // English/Target
    val text_ja: String  // Japanese/Source
)

class DictionaryProcessor {
    private val xmlMapper = XmlMapper().apply {
        registerKotlinModule()
        // Configure to handle external entities in JMdict
        factory.xmlInputFactory.apply {
            setProperty("javax.xml.stream.isSupportingExternalEntities", true)
            setProperty("javax.xml.stream.supportDTD", true)
            // JMdict has extensive entity usage, need to increase limit
            setProperty("com.ctc.wstx.maxEntityCount", Integer.MAX_VALUE)
        }
    }
    
    // Map: Kanji/Word -> Level (e.g. "猫" -> "N5")
    private var jlptMap: Map<String, String> = emptyMap()
    
    // Map: Word -> Chinese Gloss
    private var chineseThesaurus: Map<String, String> = emptyMap()

    // Custom Dictionary Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    data class CustomEntry(
        val term: String,
        val reading: String,
        val meanings: List<String>,
        val chinese_meanings: List<String> = emptyList(),
        val pos: String? = null,
        val tags: List<String> = emptyList()
    )

    private var customEntries: List<CustomEntry> = emptyList()

    init {
        loadJlptData()
        loadChineseThesaurus()
        loadCustomDictionary()
    }

    private fun loadChineseThesaurus() {
        try {
            val resource = DictionaryProcessor::class.java.getResource("/jp_zh_thesaurus.json")
            if (resource != null) {
                val jsonContent = resource.readText()
                val mapper = com.fasterxml.jackson.module.kotlin.jacksonObjectMapper()
                chineseThesaurus = mapper.readValue(
                        jsonContent,
                        object : com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {}
                )
                println("✅ Loaded ${chineseThesaurus.size} Chinese thesaurus entries")
            } else {
                // Fallback: Try loading from filesystem
                val file = File("src/main/resources/jp_zh_thesaurus.json")
                if (file.exists()) {
                    val jsonContent = file.readText()
                    val mapper = com.fasterxml.jackson.module.kotlin.jacksonObjectMapper()
                    chineseThesaurus = mapper.readValue(
                            jsonContent,
                            object : com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {}
                    )
                    println("✅ Loaded ${chineseThesaurus.size} Chinese thesaurus entries from filesystem")
                } else {
                    println("⚠️ Chinese thesaurus file not found in classpath or filesystem: /jp_zh_thesaurus.json")
                }
            }
        } catch (e: Exception) {
            println("⚠️ Could not load Chinese thesaurus: ${e.message}")
        }

        // Add manual mappings to thesaurus for enrichment of existing entries
        val manualMap = customEntries
            .filter { it.chinese_meanings.isNotEmpty() }
            .associate { it.term to it.chinese_meanings.first() }
        chineseThesaurus = chineseThesaurus + manualMap
        println("✅ Added ${manualMap.size} custom entries to Chinese thesaurus.")
    }

    private fun loadCustomDictionary() {
        try {
            // Priority: Project Root (for easier user editing)
            val schemeFile = File("custom_vocab.json")
            if (schemeFile.exists()) {
                val jsonContent = schemeFile.readText()
                val mapper = com.fasterxml.jackson.module.kotlin.jacksonObjectMapper()
                customEntries = mapper.readValue(
                    jsonContent,
                    object : com.fasterxml.jackson.core.type.TypeReference<List<CustomEntry>>() {}
                )
                println("Loaded ${customEntries.size} custom entries from project root: ${schemeFile.absolutePath}")
                return
            }

            // Fallback: Classpath (if packaged)
            val resource = javaClass.getResource("/custom_vocab.json")
            if (resource != null) {
                val jsonContent = resource.readText()
                val mapper = com.fasterxml.jackson.module.kotlin.jacksonObjectMapper()
                customEntries = mapper.readValue(
                    jsonContent,
                    object : com.fasterxml.jackson.core.type.TypeReference<List<CustomEntry>>() {}
                )
                println("Loaded ${customEntries.size} custom entries from classpath")
            } else {
                println("Custom dictionary not found in project root or classpath.")
            }
        } catch (e: Exception) {
            println("Failed to load custom dictionary: ${e.message}")
            e.printStackTrace()
        }
    }

    private fun loadJlptData() {
        try {
            // Load from classpath: "/jlpt_vocab.json"
            val resource = javaClass.getResource("/jlpt_vocab.json")
            if (resource != null) {
                val jsonContent = resource.readText()
                val mapper = com.fasterxml.jackson.module.kotlin.jacksonObjectMapper()
                // Simple map: "Word" -> "Level"
                jlptMap = mapper.readValue(
                        jsonContent, 
                        object : com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {}
                )
                println("Loaded ${jlptMap.size} JLPT entries from classpath")
            } else {
                // Fallback: Try loading from filesystem (for DictionaryBuilder)
                val file = File("src/main/resources/jlpt_vocab.json")
                if (file.exists()) {
                    val jsonContent = file.readText()
                    val mapper = com.fasterxml.jackson.module.kotlin.jacksonObjectMapper()
                    jlptMap = mapper.readValue(
                            jsonContent, 
                            object : com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {}
                    )
                    println("Loaded ${jlptMap.size} JLPT entries from filesystem")
                } else {
                    println("JLPT file not found in classpath or filesystem: /jlpt_vocab.json")
                }
            }
        } catch (e: Exception) {
            println("Failed to load JLPT data: ${e.message}")
            e.printStackTrace()
        }
    }

    fun parseDictionary(xmlContent: String): List<SimplifiedEntry> {
        val dictionary: JMdict = xmlMapper.readValue(xmlContent)
        println("Parsed JMdict with ${dictionary.entry.size} entries")

        val simplifiedEntries = mutableListOf<SimplifiedEntry>()

        for (entry in dictionary.entry) {
            val kanjiList = entry.k_ele?.map { it.keb } ?: emptyList()
            val readingList = entry.r_ele?.map { it.reb } ?: emptyList()
            val senses = entry.sense ?: emptyList()
            
            // Primary Kanji (for display if available, otherwise null)
            val primaryKanji = kanjiList.firstOrNull()
            
            // If no readings, skip
            if (readingList.isEmpty()) continue

            // Explode by Reading
            for (reading in readingList) {
                // Filter senses: Include if NO restriction OR restriction contains this reading
                val applicableSenses = senses.filter { sense ->
                    sense.stagr == null || sense.stagr.isEmpty() || sense.stagr.contains(reading)
                }

                // If no senses are specific to this reading AND there are general senses, 
                // the dictionary structure implies we should use all senses.
                val finalSenses = if (applicableSenses.isEmpty()) senses else applicableSenses

                if (finalSenses.isNotEmpty()) {
                    // 5. Look up Chinese gloss
                    val chineseGloss = findChineseGloss(primaryKanji, reading)
                    val meanings = convertSensesToMeanings(finalSenses, chineseGloss)

                    simplifiedEntries.add(
                        SimplifiedEntry(
                            ent_seq = "${entry.ent_seq}_$reading",
                            kanji = primaryKanji,
                            reading = reading,
                            meanings = meanings,
                            pitch = findPitch(entry, reading),
                            jlptLevel = findJlptLevel(primaryKanji, reading)
                        )
                    )
                }
            }
        }

        // Inject Custom Entries (Force add / prioritize)
        // We do NOT check existingReadingsCheck because we want to ensure our custom definition
        // (especially with specific Chinese glosses) is present and searchable.
        // The search logic handles multiple entries with same reading by scoring.
        var specificCustomAdded = 0
        
        for (custom in customEntries) {
             simplifiedEntries.add(
                SimplifiedEntry(
                    ent_seq = "custom_${custom.term.hashCode()}",
                    kanji = custom.term,
                    reading = custom.reading,
                    meanings = custom.meanings.mapIndexed { index, gloss -> 
                        MeaningDetail(
                            gloss = gloss, 
                            gloss_cn = custom.chinese_meanings.getOrNull(index) ?: custom.chinese_meanings.firstOrNull(), 
                            examples = emptyList()
                        ) 
                    },
                    pitch = null,
                    jlptLevel = null
                )
            )
            specificCustomAdded++
        }
        
        if (specificCustomAdded > 0) {
            println("✅ Injected $specificCustomAdded manual custom entries")
        }
        
        return simplifiedEntries
    }

    private fun findJlptLevel(kanji: String?, reading: String?): String? {
        // Try looking up by kanji first, then reading
        if (kanji != null && jlptMap.containsKey(kanji)) {
            return jlptMap[kanji]
        }
        if (reading != null && jlptMap.containsKey(reading)) {
            return jlptMap[reading]
        }
        return null
    }

    private fun findChineseGloss(kanji: String?, reading: String?): String? {
        if (kanji != null && chineseThesaurus.containsKey(kanji)) {
            return chineseThesaurus[kanji]
        }
        if (reading != null && chineseThesaurus.containsKey(reading)) {
            return chineseThesaurus[reading]
        }
        return null
    }

    private fun convertSensesToMeanings(senses: List<Sense>, chineseGloss: String?): List<MeaningDetail> {
        return senses.mapIndexed { index, sense ->
            val glossText = sense.gloss?.joinToString("; ") ?: ""
            val examples = sense.example?.map { ex ->
                ExamplePair(text = ex.ex_text, text_ja = ex.ex_text_ja)
            } ?: emptyList()
            
            // Only attach Chinese gloss to the first sense (primary meaning)
            val cn = if (index == 0) chineseGloss else null
            MeaningDetail(gloss = glossText, gloss_cn = cn, examples = examples)
        }
    }

    private fun findPitch(entry: Entry, reading: String): String? {
        // Simple logic: try to find pitch in r_ele that matches reading (if misc contains it)
        // Adjust based on actual pitch data structure if needed. 
        // For now, retaining original logic which just grabbed *any* pitch.
        // Improvements can be made if XML has specific pitch-reading binding.
        return entry.r_ele?.find { it.reb == reading }?.misc?.firstOrNull { it.matches(Regex("\\d+")) }
    }


    fun search(entries: List<SimplifiedEntry>, query: String): List<SimplifiedEntry> {
        if (query.isBlank()) return emptyList()
        val q = query.trim().lowercase()
        val isAscii = q.all { it.code < 128 }
        val romajiKana = if (isAscii) RomajiToKana.convert(q) else null
        
        // Character normalization for Chinese/Japanese variants
        val normalizedQ = if (!isAscii) KanjiNormalizer.normalize(q) else null

        // DEBUG: Trace execution for specific query
        if (q.contains("麦当劳") || q.contains("mcdonald")) {
            println("🔎 DEBUG SEARCH: q='$q', normalizedQ='$normalizedQ', isAscii=$isAscii")
        }

        return entries.mapNotNull { entry ->
            // Try scoring with original query and normalized query
            val score = calculateScore(entry, q, romajiKana)
            val normalizedScore = if (normalizedQ != null && normalizedQ != q) {
                calculateScore(entry, normalizedQ, null)
            } else 0
            
            val finalScore = maxOf(score, normalizedScore)
            
            // DEBUG: Print details if this entry is relevant
            if ((q.contains("麦当劳") || q.contains("mcdonald")) && (entry.kanji?.contains("麦当劳") == true || entry.meanings.any { it.gloss.lowercase().contains("mcdonald") || it.gloss_cn?.contains("麦当劳") == true })) {
                println("   👉 Checking Entry: ${entry.kanji} (${entry.reading})")
                println("      Score: $score (Original), $normalizedScore (Normalized)")
                println("      Meanings: ${entry.meanings.joinToString { "${it.gloss}|${it.gloss_cn}" }}")
            }

            if (finalScore > 0) entry to finalScore else null
        }
        .sortedByDescending { it.second }
        .map { it.first }
        .take(50)
    }

    private fun calculateScore(entry: SimplifiedEntry, query: String, romajiKana: String?): Int {
        var totalScore = 0

        // 1. Check Kanji & Reading (High Weight: x10)
        val wordMultiplier = 10
        val kanji = entry.kanji?.lowercase()
        val reading = entry.reading?.lowercase()

        totalScore += maxOf(
            getMatchScore(kanji, query) * wordMultiplier,
            getMatchScore(reading, query) * wordMultiplier,
            if (romajiKana != null) getMatchScore(reading, romajiKana) * wordMultiplier else 0
        )

        // 2. Check Meanings (Normal Weight: x1)
        var maxMeaningScore = 0
        for (meaning in entry.meanings) {
            val gloss = meaning.gloss.lowercase()
            maxMeaningScore = maxOf(maxMeaningScore, getMatchScore(gloss, query))
            
            // 2b. Check Chinese Meanings (Boost for non-ASCII queries)
            val glossCn = meaning.gloss_cn?.lowercase()
            if (glossCn != null) {
                val cnScore = getMatchScore(glossCn, query)
                // If query is not ASCII, give Chinese results higher weight
                // Drastically increased weight to prioritize Chinese gloss matches
                val weight = if (query.any { it.code >= 128 }) 100 else 1
                maxMeaningScore = maxOf(maxMeaningScore, cnScore * weight)
            }
        }
        totalScore += maxMeaningScore

        // If no match across any fields, return 0
        if (totalScore == 0) return 0

        // 3. JLPT Bonus
        totalScore += when (entry.jlptLevel?.uppercase()) {
            "N5" -> 100
            "N4" -> 80
            "N3" -> 60
            "N2" -> 40
            "N1" -> 20
            else -> 0
        }

        return totalScore
    }

    private fun getMatchScore(target: String?, query: String): Int {
        if (target.isNullOrEmpty()) return 0
        
        // Exact match
        if (target == query) return 500
        
        // Special case for Japanese: if exact match is needed for characters
        // But \b might fail for non-ascii. Let's use it only if query is ASCII
        val isQueryAscii = query.all { it.code < 128 }
        
        if (isQueryAscii) {
            // Word boundary match (e.g., searching "cat" matches "cat burglar" as a word)
            val wordBoundaryRegex = Regex("\\b${Regex.escape(query)}\\b")
            if (wordBoundaryRegex.containsMatchIn(target)) return 200
        }

        // Prefix match
        if (target.startsWith(query)) return 100

        // Contain match
        if (target.contains(query)) return 20

        return 0
    }

    fun getJlptStats(): Map<String, Int> {
        return mapOf("total" to jlptMap.size)
    }
}

object KanjiNormalizer {
    private val mapping = mapOf(
        '龙' to '竜',
        '马' to '馬',
        '风' to '風',
        '义' to '義',
        '乐' to '楽',
        '关' to '関',
        '显' to '顕',
        '亚' to '亜',
        '园' to '園',
        '圆' to '円',
        '团' to '団',
        '图' to '図',
        '声' to '声',
        '学' to '学',
        '宝' to '宝',
        '带' to '帯',
        '归' to '帰',
        '庆' to '慶',
        '庄' to '庄',
        '广' to '広',
        '应' to '応',
        '开' to '開',
        '弹' to '弾',
        '从' to '従',
        '战' to '戦',
        '戏' to '戯',
        '执' to '執',
        '扩' to '拡',
        '摄' to '撮',
        '断' to '断',
        '时' to '時',
        '旧' to '旧',
        '昼' to '昼',
        '晚' to '晩',
        '检' to '検',
        '步' to '歩',
        '气' to '気',
        '济' to '済',
        '满' to '満',
        '浓' to '濃',
        '烂' to '爛',
        '爷' to '爺',
        '牵' to '牽',
        '犹' to '猶',
        '现' to '現',
        '画' to '画',
        '发' to '発',
        '盘' to '盤',
        '真' to '真',
        '礼' to '礼',
        '研' to '研',
        '窍' to '竅',
        '签' to '籤',
        '节' to '節',
        '肃' to '粛',
        '紧' to '緊',
        '继' to '継',
        '练' to '練',
        '县' to '県',
        '总' to '総',
        '联' to '連',
        '声' to '声',
        '处' to '処',
        '备' to '備',
        '变' to '変',
        '辞' to '辞',
        '边' to '辺',
        '进' to '進',
        '选' to '選',
        '邻' to '隣',
        '酿' to '醸',
        '释' to '釈',
        '铁' to '鉄',
        '钱' to '銭',
        '锐' to '鋭',
        '阅' to '閲',
        '际' to '際',
        '难' to '難',
        '颠' to '顛',
        '馋' to '饞',
        '马' to '馬',
        '驳' to '駁',
        '驻' to '駐',
        '验' to '験',
        '骤' to '驟',
        '高' to '高',
        '鱼' to '魚',
        '鲜' to '鮮',
        '鸟' to '鳥',
        '鸡' to '鶏',
        '龙' to '竜',
        '狗' to '犬'
    )

    fun normalize(input: String): String {
        return input.map { mapping[it] ?: it }.joinToString("")
    }
}

object RomajiToKana {
    private val mapping = mapOf(
        "a" to "あ", "i" to "い", "u" to "う", "e" to "え", "o" to "お",
        "ka" to "か", "ki" to "き", "ku" to "く", "ke" to "け", "ko" to "こ",
        "sa" to "さ", "shi" to "し", "su" to "す", "se" to "せ", "so" to "そ",
        "ta" to "た", "chi" to "ち", "tsu" to "つ", "te" to "て", "to" to "と",
        "na" to "な", "ni" to "に", "nu" to "ぬ", "ne" to "ね", "no" to "の",
        "ha" to "は", "hi" to "ひ", "fu" to "ふ", "he" to "へ", "ho" to "ほ",
        "ma" to "ま", "mi" to "み", "mu" to "む", "me" to "め", "mo" to "も",
        "ya" to "や", "yu" to "ゆ", "yo" to "よ",
        "ra" to "ら", "ri" to "り", "ru" to "る", "re" to "れ", "ro" to "ろ",
        "wa" to "わ", "wo" to "を", "n" to "ん",
        "ga" to "が", "gi" to "ぎ", "gu" to "ぐ", "ge" to "げ", "go" to "ご",
        "za" to "ざ", "ji" to "じ", "zu" to "ず", "ze" to "ぜ", "zo" to "ぞ",
        "da" to "だ", "di" to "ぢ", "du" to "づ", "de" to "で", "do" to "ど",
        "ba" to "ば", "bi" to "び", "bu" to "ぶ", "be" to "べ", "bo" to "ぼ",
        "pa" to "ぱ", "pi" to "ぴ", "pu" to "ぷ", "pe" to "ぺ", "po" to "ぽ",
        "kya" to "きゃ", "kyu" to "きゅ", "kyo" to "きょ",
        "sha" to "しゃ", "shu" to "しゅ", "sho" to "しょ",
        "cha" to "ちゃ", "chu" to "ちゅ", "cho" to "ちょ",
        "nya" to "にゃ", "nyu" to "にゅ", "nyo" to "にょ",
        "hya" to "ひゃ", "hyu" to "ひゅ", "hyo" to "ひょ",
        "mya" to "みゃ", "myu" to "みゅ", "myo" to "みょ",
        "rya" to "りゃ", "ryu" to "りゅ", "ryo" to "りょ",
        "gya" to "ぎゃ", "gyu" to "ぎゅ", "gyo" to "ぎょ",
        "ja" to "じゃ", "ju" to "じゅ", "jo" to "じょ",
        "bya" to "びゃ", "byu" to "びゅ", "byo" to "びょ",
        "pya" to "ぴゃ", "pyu" to "ぴゅ", "pyo" to "ぴょ"
    )

    fun convert(input: String): String? {
        val result = StringBuilder()
        var i = 0
        val lower = input.lowercase()
        while (i < lower.length) {
            var found = false
            // Try 3 chars, then 2, then 1
            for (len in 3 downTo 1) {
                if (i + len <= lower.length) {
                    val part = lower.substring(i, i + len)
                    val kana = mapping[part]
                    if (kana != null) {
                        result.append(kana)
                        i += len
                        found = true
                        break
                    }
                }
            }
            if (!found) {
                // Check for double consonants (small tsu)
                if (i + 1 < lower.length && lower[i] == lower[i + 1] && lower[i] in 'a'..'z' && lower[i] !in "aeiou") {
                    result.append("っ")
                    i += 1
                    found = true
                }
            }
            if (!found) {
                // If not found and not a special case, it's not a valid romaji string we can convert fully
                // but we might want to just keep it as is or return null. 
                // For search, returning null if it contains non-romaji chars is safer.
                return null 
            }
        }
        return result.toString()
    }
}
