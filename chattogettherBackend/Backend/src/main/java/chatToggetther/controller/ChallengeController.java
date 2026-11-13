package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.DTO.ChallengeDTO;
import chatToggetther.DataRequest.CreateChallengeRequest;
import chatToggetther.service.ChallengeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/challenges")
@RequiredArgsConstructor
public class ChallengeController {

    private final ChallengeService challengeService;

    @GetMapping("/random")
    public ResponseEntity<ResponseData<ChallengeDTO>> getRandomChallenge(
            @RequestParam(value = "category", required = false) String category
    ) {
        ChallengeDTO dto = challengeService.getRandomChallenge(category);
        return ResponseEntity.ok(new ResponseData<>(200, "Lấy câu hỏi thử thách thành công", dto));
    }

    @GetMapping("/categories")
    public ResponseEntity<ResponseData<List<Map<String, Object>>>> getCategories() {
        List<Map<String, Object>> categories = challengeService.getCategories();
        return ResponseEntity.ok(new ResponseData<>(200, "Danh sách thể loại thử thách", categories));
    }

    @PostMapping
    public ResponseEntity<ResponseData<ChallengeDTO>> createChallenge(
            JwtAuthenticationToken token,
            @RequestBody CreateChallengeRequest request
    ) {
        ChallengeDTO created = challengeService.createChallenge(token, request);
        return ResponseEntity.ok(new ResponseData<>(201, "Đã đóng góp câu hỏi thành công!", created));
    }
}
