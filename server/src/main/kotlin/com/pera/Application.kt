package com.pera

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import io.ktor.server.plugins.cors.routing.*
import io.ktor.http.*
import java.util.zip.GZIPInputStream
import kotlinx.serialization.json.decodeFromStream

fun main() {
    embeddedServer(Netty, port = 8082, host = "0.0.0.0", module = Application::module)
        .start(wait = true)
}

fun Application.module() {
    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.AccessControlAllowOrigin)
        // allowHeader("ngrok-skip-browser-warning") // helpful if using ngrok
        
        // Explicitly allow the origins
        allowHost("kidwon.github.io", schemes = listOf("https"))
        allowHost("localhost:3000", schemes = listOf("http"))
        allowHost("localhost:3100", schemes = listOf("http"))
        
        // Allow all subdomain for trycloudflare
        allowHost("*.trycloudflare.com", schemes = listOf("https"))
        
        allowNonSimpleContentTypes = true
        allowCredentials = true
        anyHost() 
    }
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
        })
    }
    configureRouting()
}


fun Application.configureRouting() {
    val processor = DictionaryProcessor()
    
    // Load pre-generated JSON snapshot (GZIP compressed) for fast startup
    val dictionaryEntries = try {
        val resource = Application::class.java.getResource("/dictionary_snapshot.json.gz")
        if (resource != null) {
            println("Loading compressed dictionary snapshot...")
            val startTime = System.currentTimeMillis()
            
            val entries = resource.openStream().use { inputStream ->
                GZIPInputStream(inputStream).use { gzis ->
                    val json = Json { ignoreUnknownKeys = true }
                    json.decodeFromStream<List<SimplifiedEntry>>(gzis)
                }
            }
            
            val loadTime = System.currentTimeMillis() - startTime
            println("✅ Loaded ${entries.size} entries in ${loadTime}ms")
            
            // Print JLPT statistics
            val jlptStats = entries.groupingBy { it.jlptLevel ?: "No Level" }.eachCount()
            println("📊 JLPT Distribution:")
            jlptStats.toSortedMap().forEach { (level, count) ->
                println("  $level: $count")
            }
            
            entries
        } else {
            println("⚠️ Dictionary snapshot not found, using dummy data")
            val xmlResource = Application::class.java.getResource("/jmdict_dummy.xml")
            if (xmlResource != null) {
                processor.parseDictionary(xmlResource.readText())
            } else {
                emptyList()
            }
        }
    } catch (e: Exception) {
        println("❌ Error loading dictionary: ${e.message}")
        e.printStackTrace()
        emptyList()
    }

    routing {
        get("/") {
            call.respondText("Hello World!")
        }
        get("/health") {
            call.respond(mapOf("status" to "ok"))
        }
        get("/api/dictionary/seed") {
            call.respond(dictionaryEntries)
        }
        get("/api/debug/stats") {
            call.respond(processor.getJlptStats())
        }
        get("/api/dictionary/search") {
            val rawQuery = call.request.queryParameters["q"] ?: ""
            // Fix potential encoding issues where UTF-8 bytes are interpreted as ISO-8859-1
            val query = if (rawQuery.any { it.code in 0x80..0xFF }) {
                try {
                    String(rawQuery.toByteArray(Charsets.ISO_8859_1), Charsets.UTF_8)
                } catch (e: Exception) {
                    rawQuery
                }
            } else {
                rawQuery
            }
            
            if (query.isBlank()) {
                call.respond(emptyList<SimplifiedEntry>())
            } else {
                val results = processor.search(dictionaryEntries, query)
                call.respond(results)
            }
        }
    }
}
