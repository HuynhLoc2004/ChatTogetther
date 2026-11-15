package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.modelEntity.ReactionDefinitionEntity;
import chatToggetther.repository.ReactionDefinitionRepository;
import chatToggetther.service.ReactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ReactionController {

    private final ReactionService reactionService;
    private final ReactionDefinitionRepository reactionDefinitionRepository;

    @GetMapping("/public/reactions")
    public ResponseEntity<ResponseData<List<ReactionDefinitionEntity>>> getPublicReactions() {
        return ResponseEntity.ok(new ResponseData<>(200, "Danh sách cảm xúc khả dụng", this.reactionService.getActiveReactions()));
    }

    @GetMapping("/admin/reactions")
    @PreAuthorize("hasRole('ADMIN') or hasRole('AMDIN')")
    public ResponseEntity<ResponseData<Map<String, Object>>> getAdminReactions() {
        return ResponseEntity.ok(new ResponseData<>(200, "Thống kê danh mục cảm xúc hệ thống", this.reactionService.getAdminReactionStats()));
    }

    @PostMapping("/admin/reactions")
    @PreAuthorize("hasRole('ADMIN') or hasRole('AMDIN')")
    public ResponseEntity<ResponseData<ReactionDefinitionEntity>> createReaction(@RequestBody ReactionDefinitionEntity entity) {
        if (entity.getCode() == null || entity.getCode().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new ResponseData<>(400, "Mã cảm xúc không được để trống", null));
        }
        entity.setCode(entity.getCode().trim().toUpperCase());
        if (entity.getStatus() == null) entity.setStatus("ACTIVE");
        if (entity.getSortOrder() == null) entity.setSortOrder(0);
        ReactionDefinitionEntity saved = this.reactionDefinitionRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Tạo cảm xúc thành công", saved));
    }

    @PutMapping("/admin/reactions/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('AMDIN')")
    public ResponseEntity<ResponseData<ReactionDefinitionEntity>> updateReaction(
            @PathVariable("id") Long id,
            @RequestBody ReactionDefinitionEntity update) {
        return this.reactionDefinitionRepository.findById(id).map(existing -> {
            if (update.getLabel() != null) existing.setLabel(update.getLabel());
            if (update.getEmoji() != null) existing.setEmoji(update.getEmoji());
            if (update.getSortOrder() != null) existing.setSortOrder(update.getSortOrder());
            if (update.getStatus() != null) existing.setStatus(update.getStatus());
            ReactionDefinitionEntity saved = this.reactionDefinitionRepository.save(existing);
            return ResponseEntity.ok(new ResponseData<>(200, "Cập nhật cảm xúc thành công", saved));
        }).orElseGet(() -> ResponseEntity.status(404).body(new ResponseData<>(404, "Không tìm thấy cảm xúc", null)));
    }

    @DeleteMapping("/admin/reactions/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('AMDIN')")
    public ResponseEntity<ResponseData<Void>> deleteReaction(@PathVariable("id") Long id) {
        this.reactionDefinitionRepository.deleteById(id);
        return ResponseEntity.ok(new ResponseData<>(200, "Đã xóa cảm xúc", null));
    }
}
