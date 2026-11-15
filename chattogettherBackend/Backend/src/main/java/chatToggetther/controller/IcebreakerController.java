package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.ChallengeDTO;
import chatToggetther.DataRequest.IcebreakerSubmitRequest;
import chatToggetther.service.ChallengeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class IcebreakerController {

    private final ChallengeService challengeService;

    /**
     * POST /api/public/icebreakers/{id}/draw
     * Atomic Draw Counter (Chống Race Condition)
     */
    @PostMapping({"/public/icebreakers/{id}/draw", "/public/challenges/{id}/draw"})
    public ResponseEntity<ResponseData<Map<String, Object>>> drawCard(@PathVariable("id") Long id) {
        Map<String, Object> result = challengeService.atomicDraw(id);
        return ResponseEntity.ok(new ResponseData<>(200, "Đã tăng lượt bốc thẻ bài thành công", result));
    }

    /**
     * GET /api/public/icebreakers
     * Chỉ trả về các thẻ có status = "ACTIVE", sắp xếp theo sortOrder ASC, createdAt DESC
     */
    @GetMapping({"/public/icebreakers", "/public/challenges"})
    public ResponseEntity<ResponseData<List<ChallengeDTO>>> getActiveIcebreakers(
            @RequestParam(value = "category", required = false) String category
    ) {
        List<ChallengeDTO> cards = challengeService.getActiveIcebreakers(category);
        return ResponseEntity.ok(new ResponseData<>(200, "Danh sách thẻ bài thử thách", cards));
    }

    /**
     * POST /api/icebreakers/submit (yêu cầu JWT)
     * Validate độ dài nội dung (10 - 220 ký tự), giới hạn tốc độ tối đa 3 câu / 1 giờ / user.
     * Lưu vào PostgreSQL với status = "PENDING", authorId = currentUser.id, drawCount = 0.
     */
    @PostMapping({"/icebreakers/submit", "/challenges/submit"})
    public ResponseEntity<ResponseData<ChallengeDTO>> submitIcebreaker(
            JwtAuthenticationToken token,
            @RequestBody IcebreakerSubmitRequest request
    ) {
        try {
            ChallengeDTO created = challengeService.submitUserIcebreaker(token, request);
            return ResponseEntity.ok(new ResponseData<>(201, "Đã gửi câu hỏi đóng góp thành công! Đang chờ duyệt.", created));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ResponseData<>(400, e.getMessage(), null));
        }
    }
}
