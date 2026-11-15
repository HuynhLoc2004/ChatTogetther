package chatToggetther.DTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReactionSummaryDTO {
    private Long postId;
    private long totalCount;
    private List<ReactionCountDTO> topReactions; // tối đa 5 loại cảm xúc có count > 0, sắp xếp giảm dần
    private String userReaction; // cảm xúc hiện tại của user hoặc null
}
