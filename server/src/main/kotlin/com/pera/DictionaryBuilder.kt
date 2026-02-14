package com.pera

import kotlinx.serialization.json.Json
import java.io.File
import java.util.zip.GZIPOutputStream
import kotlinx.serialization.json.encodeToStream

/**
 * Offline Dictionary Builder
 * Reads jmdict_full.xml and generates a JSON snapshot for fast loading
 */
fun main() {
    println("=== Dictionary Builder ===")
    println("Starting dictionary preprocessing...")
    
    val resourcesDir = File("src/main/resources")
    val xmlFile = File(resourcesDir, "jmdict_full.xml")
    val outputFile = File(resourcesDir, "dictionary_snapshot.json")
    
    if (!xmlFile.exists()) {
        println("❌ Error: jmdict_full.xml not found at ${xmlFile.absolutePath}")
        return
    }
    
    println("📖 Reading XML file (${xmlFile.length() / 1024 / 1024}MB)...")
    val xmlContent = xmlFile.readText()
    
    println("🔄 Parsing dictionary entries...")
    val processor = DictionaryProcessor()
    val entries = processor.parseDictionary(xmlContent)
    
    println("✅ Parsed ${entries.size} entries")
    
    // Get JLPT statistics
    val jlptStats = entries.groupingBy { it.jlptLevel ?: "No Level" }.eachCount()
    println("\n📊 JLPT Distribution:")
    jlptStats.toSortedMap().forEach { (level, count) ->
        println("  $level: $count entries")
    }
    
    println("\n💾 Serializing to JSON and compressing with GZIP...")
    val gzipFile = File(resourcesDir, "dictionary_snapshot.json.gz")
    
    gzipFile.outputStream().use { fos ->
        GZIPOutputStream(fos).use { gzos ->
            val json = Json { 
                prettyPrint = false 
                encodeDefaults = false
            }
            json.encodeToStream(entries, gzos)
        }
    }
    
    // Remove the uncompressed JSON if it exists to avoid confusion
    if (outputFile.exists()) outputFile.delete()
    
    val outputSizeMB = gzipFile.length() / 1024.0 / 1024.0
    println("✅ Generated compressed dictionary snapshot: ${String.format("%.2f", outputSizeMB)}MB")
    println("   - File: ${gzipFile.absolutePath}")
    println("   - Total entries: ${entries.size}")
    println("   - With JLPT levels: ${entries.count { it.jlptLevel != null }}")
    println("\n🎉 Dictionary build complete!")
}
