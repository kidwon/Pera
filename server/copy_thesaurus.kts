import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

fun main() {
    val source = File("/tmp/jp_zh_thesaurus.json")
    val destination = File("/Users/kid/priv/Pera/server/src/main/resources/jp_zh_thesaurus.json")
    
    println("Copying from ${source.absolutePath} to ${destination.absolutePath}...")
    try {
        Files.copy(source.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
        println("✅ Successfully copied thesaurus file.")
    } catch (e: Exception) {
        println("❌ Failed to copy: ${e.message}")
        e.printStackTrace()
    }
}

main()
