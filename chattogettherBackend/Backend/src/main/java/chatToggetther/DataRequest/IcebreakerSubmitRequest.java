package chatToggetther.DataRequest;

import lombok.*;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class IcebreakerSubmitRequest {
    private String question;
    private String content;
    private String category;

    public String getEffectiveContent() {
        if (question != null && !question.trim().isEmpty()) return question.trim();
        if (content != null && !content.trim().isEmpty()) return content.trim();
        return "";
    }
}
