package com.nouhouari.conductor.scenarios;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * One scenario summary as returned by {@code GET /api/scenarios} (with
 * {@code content=true}). Java port of the {@code RemoteScenarioSummary}
 * interface in {@code src/scenarios/RemoteScenarioFetcher.ts}.
 *
 * @param id             testKey, i.e. {@code ${feature}::${name}}
 * @param tags           effective tags, including those inherited from the feature
 * @param content        raw gherkin of this scenario block (its own tag lines + steps + Examples)
 * @param background     raw gherkin of the feature's Background block ("" when none)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RemoteScenarioSummary(
        String id,
        String feature,
        String name,
        List<String> tags,
        List<String> storyIds,
        List<String> requirementIds,
        Boolean valid,
        Boolean hasContent,
        Boolean hasBackground,
        String status,
        String content,
        String background) {

    public List<String> tagsOrEmpty() {
        return tags != null ? tags : List.of();
    }

    public String contentOrEmpty() {
        return content != null ? content : "";
    }

    public String backgroundOrEmpty() {
        return background != null ? background : "";
    }
}
