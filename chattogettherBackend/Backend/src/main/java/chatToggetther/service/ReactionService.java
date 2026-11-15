package chatToggetther.service;

import chatToggetther.DTO.ReactionCountDTO;
import chatToggetther.DTO.ReactionSummaryDTO;
import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.PostLikeEntity;
import chatToggetther.modelEntity.ReactionDefinitionEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.PostLikeRepository;
import chatToggetther.repository.ReactionDefinitionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class ReactionService {

    private final ReactionDefinitionRepository reactionDefinitionRepository;
    private final PostLikeRepository postLikeRepository;

    private static final List<ReactionDefinitionEntity> DEFAULT_REACTIONS = List.of(
            ReactionDefinitionEntity.builder().code("HEART").emoji("❤️").label("Yêu thích").sortOrder(1).status("ACTIVE").build(),
            ReactionDefinitionEntity.builder().code("FIRE").emoji("🔥").label("Bùng nổ").sortOrder(2).status("ACTIVE").build(),
            ReactionDefinitionEntity.builder().code("HAHA").emoji("😂").label("Haha").sortOrder(3).status("ACTIVE").build(),
            ReactionDefinitionEntity.builder().code("WOW").emoji("😮").label("Wow").sortOrder(4).status("ACTIVE").build(),
            ReactionDefinitionEntity.builder().code("LIKE").emoji("👍").label("Thích").sortOrder(5).status("ACTIVE").build(),
            ReactionDefinitionEntity.builder().code("CROWN").emoji("👑").label("Đỉnh cao").sortOrder(6).status("ACTIVE").build(),
            ReactionDefinitionEntity.builder().code("CLAP").emoji("👏").label("Vỗ tay").sortOrder(7).status("ACTIVE").build()
    );

    @PostConstruct
    public void initDefaultReactions() {
        try {
            if (reactionDefinitionRepository.count() == 0) {
                reactionDefinitionRepository.saveAll(DEFAULT_REACTIONS);
            }
        } catch (Exception ignored) {}
    }

    public List<ReactionDefinitionEntity> getActiveReactions() {
        List<ReactionDefinitionEntity> list = reactionDefinitionRepository.findByStatusOrderBySortOrderAsc("ACTIVE");
        return (list != null && !list.isEmpty()) ? list : DEFAULT_REACTIONS;
    }

    public List<ReactionDefinitionEntity> getAllReactionsForAdmin() {
        List<ReactionDefinitionEntity> list = reactionDefinitionRepository.findAllByOrderBySortOrderAsc();
        return (list != null && !list.isEmpty()) ? list : DEFAULT_REACTIONS;
    }

    public Map<String, Object> getAdminReactionStats() {
        List<ReactionDefinitionEntity> defs = getAllReactionsForAdmin();
        List<Object[]> globalCounts = postLikeRepository.countAllGroupedByReactionType();
        Map<String, Long> countMap = new HashMap<>();
        long totalReactions = 0;
        for (Object[] row : globalCounts) {
            String type = String.valueOf(row[0]).toUpperCase();
            long count = ((Number) row[1]).longValue();
            countMap.put(type, count);
            totalReactions += count;
        }

        List<Map<String, Object>> statsList = new ArrayList<>();
        for (ReactionDefinitionEntity def : defs) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", def.getId());
            item.put("code", def.getCode());
            item.put("label", def.getLabel());
            item.put("emoji", def.getEmoji());
            item.put("sortOrder", def.getSortOrder());
            item.put("status", def.getStatus());
            item.put("totalCount", countMap.getOrDefault(def.getCode().toUpperCase(), 0L));
            statsList.add(item);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("totalReactions", totalReactions);
        res.put("reactions", statsList);
        return res;
    }

    public String getEmojiForType(String type) {
        if (type == null) return "❤️";
        for (ReactionDefinitionEntity def : getActiveReactions()) {
            if (def.getCode().equalsIgnoreCase(type)) {
                return def.getEmoji();
            }
        }
        return switch (type.toUpperCase()) {
            case "FIRE" -> "🔥";
            case "HAHA" -> "😂";
            case "WOW" -> "😮";
            case "LIKE" -> "👍";
            case "CROWN" -> "👑";
            case "CLAP" -> "👏";
            default -> "❤️";
        };
    }

    public String getLabelForType(String type) {
        if (type == null) return "Yêu thích";
        for (ReactionDefinitionEntity def : getActiveReactions()) {
            if (def.getCode().equalsIgnoreCase(type)) {
                return def.getLabel();
            }
        }
        return switch (type.toUpperCase()) {
            case "FIRE" -> "Bùng nổ";
            case "HAHA" -> "Haha";
            case "WOW" -> "Wow";
            case "LIKE" -> "Thích";
            case "CROWN" -> "Đỉnh cao";
            case "CLAP" -> "Vỗ tay";
            default -> "Yêu thích";
        };
    }

    public ReactionSummaryDTO getReactionSummary(Long postId, UserEntity currentUser, PostEntity postEntity) {
        List<Object[]> rawCounts = postLikeRepository.findReactionCountsByPostId(postId);
        long total = 0;
        List<ReactionCountDTO> topReactions = new ArrayList<>();

        for (Object[] row : rawCounts) {
            String type = String.valueOf(row[0]).toUpperCase();
            long count = ((Number) row[1]).longValue();
            total += count;
            if (count > 0 && topReactions.size() < 5) {
                topReactions.add(ReactionCountDTO.builder()
                        .type(type)
                        .emoji(getEmojiForType(type))
                        .label(getLabelForType(type))
                        .count(count)
                        .build());
            }
        }

        String userReaction = null;
        if (currentUser != null && postEntity != null) {
            Optional<PostLikeEntity> userLike = postLikeRepository.findByPostAndUser(postEntity, currentUser);
            if (userLike.isPresent()) {
                userReaction = userLike.get().getReactionType();
            }
        }

        return ReactionSummaryDTO.builder()
                .postId(postId)
                .totalCount(total)
                .topReactions(topReactions)
                .userReaction(userReaction)
                .build();
    }
}
