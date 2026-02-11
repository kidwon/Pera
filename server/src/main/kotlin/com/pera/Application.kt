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
    // Load dictionary once at startup
    // Load dictionary once at startup
    val processor = DictionaryProcessor()
    // Use classpath resource loading
    val dictionaryEntries = try {
        val resource = Application::class.java.getResource("/jmdict_dummy.xml")
        if (resource != null) {
            println("Loading dictionary from ${resource.path}...")
            processor.parseDictionary(resource.readText())
        } else {
            println("Dictionary file not found in classpath")
            emptyList()
        }
    } catch (e: Exception) {
        println("Error loading dictionary: ${e.message}")
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
            val query = call.request.queryParameters["q"]
            if (query.isNullOrBlank()) {
                call.respond(emptyList<SimplifiedEntry>())
            } else {
                val results = processor.search(dictionaryEntries, query)
                call.respond(results)
            }
        }
    }
}
