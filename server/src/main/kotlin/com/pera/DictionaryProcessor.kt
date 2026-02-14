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

    init {
        loadJlptData()
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
                println("Loaded ${jlptMap.size} JLPT entries")
            } else {
                println("JLPT file not found in classpath: /jlpt_vocab.json")
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
                    simplifiedEntries.add(
                        SimplifiedEntry(
                            ent_seq = "${entry.ent_seq}_$reading",
                            kanji = primaryKanji,
                            reading = reading,
                            meanings = convertSensesToMeanings(finalSenses),
                            pitch = findPitch(entry, reading),
                            jlptLevel = findJlptLevel(primaryKanji, reading)
                        )
                    )
                }
            }
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

    private fun convertSensesToMeanings(senses: List<Sense>): List<MeaningDetail> {
        return senses.map { sense ->
            val glossText = sense.gloss?.joinToString("; ") ?: ""
            val examples = sense.example?.map { ex ->
                ExamplePair(text = ex.ex_text, text_ja = ex.ex_text_ja)
            } ?: emptyList()
            MeaningDetail(gloss = glossText, examples = examples)
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

        return entries.mapNotNull { entry ->
            val score = calculateScore(entry, q, romajiKana)
            if (score > 0) entry to score else null
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
        if (target == null || target.isEmpty()) return 0
        
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
