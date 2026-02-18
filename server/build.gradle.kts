plugins {
    kotlin("jvm") version "1.9.23"
    id("io.ktor.plugin") version "2.3.9"
    kotlin("plugin.serialization") version "1.9.23"
}

group = "com.pera"
version = "0.0.1"

application {
    mainClass.set("com.pera.ApplicationKt")
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("io.ktor:ktor-server-core-jvm")
    implementation("io.ktor:ktor-server-netty-jvm")
    implementation("io.ktor:ktor-server-content-negotiation-jvm")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm")
    implementation("io.ktor:ktor-server-cors-jvm")
    implementation("com.fasterxml.jackson.dataformat:jackson-dataformat-xml:2.15.3")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.15.3")
    implementation("ch.qos.logback:logback-classic:1.4.14")
    implementation("io.arrow-kt:arrow-core:1.2.1")
    implementation("io.netty:netty-resolver-dns-native-macos:4.1.107.Final:osx-aarch_64")
    testImplementation("io.ktor:ktor-server-tests-jvm")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit")
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs = listOf("-Xuse-k2=false")
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.processResources {
    exclude("jmdict_full.xml")
    exclude("jp_zh_thesaurus_test.json")
    exclude("jmdict_dummy.xml")
    exclude("jlpt_vocab.json")
    exclude("custom_vocab*.json")
    exclude("test_perm.json")
}

// Task to build dictionary snapshot
tasks.register<JavaExec>("buildDictionary") {
    group = "application"
    description = "Generate dictionary JSON snapshot from JMdict XML"
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("com.pera.DictionaryBuilderKt")
    jvmArgs = listOf("-Xmx2g") // Increase heap for large XML parsing and serialization
}