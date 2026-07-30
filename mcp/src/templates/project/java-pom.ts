/**
 * Generates pom.xml content for a bootstrapped Java Conductor test project.
 * Versions mirror java/pom.xml and java/conductor-example/pom.xml.
 */

export interface JavaPomOptions {
  readonly name: string;
  readonly groupId: string;
  readonly artifactId: string;
  readonly platforms: readonly string[];
}

export function renderJavaPom(options: JavaPomOptions): string {
  const { name, groupId, artifactId } = options;

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>${groupId}</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>0.1.0-SNAPSHOT</version>
  <packaging>jar</packaging>

  <name>${name}</name>
  <description>Conductor Java/Cucumber-JVM end-to-end test project.</description>

  <properties>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
    <maven.compiler.release>17</maven.compiler.release>

    <conductor.version>0.1.0-SNAPSHOT</conductor.version>
    <cucumber.version>7.18.1</cucumber.version>
    <junit.jupiter.version>5.10.3</junit.jupiter.version>
    <junit.platform.version>1.10.3</junit.platform.version>
    <allure.version>2.29.0</allure.version>
    <assertj.version>3.26.3</assertj.version>

    <maven.compiler.plugin.version>3.13.0</maven.compiler.plugin.version>
    <maven.surefire.plugin.version>3.2.5</maven.surefire.plugin.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>com.nouhouari.conductor</groupId>
      <artifactId>conductor-core</artifactId>
      <version>\${conductor.version}</version>
    </dependency>

    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-java</artifactId>
      <version>\${cucumber.version}</version>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-picocontainer</artifactId>
      <version>\${cucumber.version}</version>
    </dependency>
    <dependency>
      <groupId>io.cucumber</groupId>
      <artifactId>cucumber-junit-platform-engine</artifactId>
      <version>\${cucumber.version}</version>
    </dependency>

    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>\${junit.jupiter.version}</version>
    </dependency>
    <dependency>
      <groupId>org.junit.platform</groupId>
      <artifactId>junit-platform-suite</artifactId>
      <version>\${junit.platform.version}</version>
    </dependency>
    <dependency>
      <groupId>io.qameta.allure</groupId>
      <artifactId>allure-cucumber7-jvm</artifactId>
      <version>\${allure.version}</version>
    </dependency>
    <dependency>
      <groupId>org.assertj</groupId>
      <artifactId>assertj-core</artifactId>
      <version>\${assertj.version}</version>
    </dependency>
  </dependencies>

  <build>
    <testResources>
      <testResource>
        <directory>src/test/resources</directory>
        <filtering>true</filtering>
      </testResource>
    </testResources>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>\${maven.compiler.plugin.version}</version>
        <configuration>
          <release>\${maven.compiler.release}</release>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>\${maven.surefire.plugin.version}</version>
        <configuration>
          <workingDirectory>\${project.basedir}</workingDirectory>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`;
}
