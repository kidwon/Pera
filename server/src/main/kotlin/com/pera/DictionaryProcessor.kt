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
    val pitch: String?
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
            
            // If no readings, skip (shouldn't happen in valid JMdict)
            if (readingList.isEmpty()) {
                // Fallback: create one entry if only kanji exists (rare)
                simplifiedEntries.add(
                    SimplifiedEntry(
                        ent_seq = entry.ent_seq,
                        kanji = primaryKanji,
                        reading = null,
                        meanings = convertSensesToMeanings(senses),
                        pitch = null
                    )
                )
                continue
            }

            // Explode by Reading
            for (reading in readingList) {
                // Filter senses: Include if NO restriction OR restriction contains this reading
                val applicableSenses = senses.filter { sense ->
                    sense.stagr == null || sense.stagr.isEmpty() || sense.stagr.contains(reading)
                }

                if (applicableSenses.isNotEmpty()) {
                    simplifiedEntries.add(
                        SimplifiedEntry(
                            ent_seq = "${entry.ent_seq}_$reading", // Unique ID for split entry
                            kanji = primaryKanji,
                            reading = reading,
                            meanings = convertSensesToMeanings(applicableSenses),
                            pitch = findPitch(entry, reading)
                        )
                    )
                }
            }
        }
        
        return simplifiedEntries
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
        val q = query.trim()
        
        val isAscii = q.all { it.code < 128 }
        
        return if (isAscii) {
            val regex = Regex("\\b${Regex.escape(q)}\\b", RegexOption.IGNORE_CASE)
            entries.filter { entry ->
                entry.kanji?.contains(q, ignoreCase = true) == true ||
                entry.reading?.contains(q, ignoreCase = true) == true ||
                entry.meanings.any { it.gloss.contains(regex) } // Check description only for now
            }
        } else {
            val lowerQ = q.lowercase()
            entries.filter { entry ->
                entry.kanji?.contains(lowerQ) == true ||
                entry.reading?.contains(lowerQ) == true ||
                entry.meanings.any { it.gloss.lowercase().contains(lowerQ) }
            }
        }
    }
}
