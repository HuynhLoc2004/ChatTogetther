package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.modelEntity.CommunityCategoryEntity;
import chatToggetther.repository.CommunityCategoryRepository;
import chatToggetther.repository.CommunityGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping({"/api/communities/categories", "/api/groups/categories"})
@RequiredArgsConstructor
public class CommunityCategoryController {

    private final CommunityCategoryRepository categoryRepository;
    private final CommunityGroupRepository groupRepository;

    @GetMapping
    public ResponseEntity<ResponseData<List<CommunityCategoryEntity>>> getActiveCategories() {
        List<CommunityCategoryEntity> list = this.categoryRepository.findAll();

        // Lấy số lượng nhóm đang hoạt động theo categoryId & categoryName & categoryCode
        Map<Long, Long> countById = new HashMap<>();
        Map<String, Long> countByName = new HashMap<>();
        Map<String, Long> countByCode = new HashMap<>();

        try {
            for (Object[] row : this.groupRepository.countActiveGroupsByCategoryId()) {
                if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
                    countById.put(Long.valueOf(row[0].toString()), Long.valueOf(row[1].toString()));
                }
            }
            for (Object[] row : this.groupRepository.countActiveGroupsByCategoryName()) {
                if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
                    countByName.put(row[0].toString().trim().toLowerCase(), Long.valueOf(row[1].toString()));
                }
            }
            for (Object[] row : this.groupRepository.countActiveGroupsByCategoryCode()) {
                if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
                    countByCode.put(row[0].toString().trim().toLowerCase(), Long.valueOf(row[1].toString()));
                }
            }
        } catch (Exception e) {}

        List<CommunityCategoryEntity> result = new ArrayList<>();
        for (CommunityCategoryEntity cat : list) {
            if (Boolean.FALSE.equals(cat.getIsActive()) || "HIDDEN".equalsIgnoreCase(cat.getStatus())) {
                continue;
            }
            long count = 0L;
            if (cat.getId() != null && countById.containsKey(cat.getId())) {
                count = Math.max(count, countById.get(cat.getId()));
            }
            if (cat.getName() != null && countByName.containsKey(cat.getName().trim().toLowerCase())) {
                count = Math.max(count, countByName.get(cat.getName().trim().toLowerCase()));
            }
            if (cat.getSlug() != null && countByCode.containsKey(cat.getSlug().trim().toLowerCase())) {
                count = Math.max(count, countByCode.get(cat.getSlug().trim().toLowerCase()));
            }
            cat.setCommunityCount(count);
            result.add(cat);
        }

        // Sắp xếp: isPinned DESC, communityCount DESC, displayOrder ASC, id ASC
        result.sort((a, b) -> {
            boolean pinA = Boolean.TRUE.equals(a.getIsPinned());
            boolean pinB = Boolean.TRUE.equals(b.getIsPinned());
            if (pinA != pinB) return pinB ? 1 : -1;

            long cA = a.getCommunityCount() != null ? a.getCommunityCount() : 0L;
            long cB = b.getCommunityCount() != null ? b.getCommunityCount() : 0L;
            if (cA != cB) return Long.compare(cB, cA);

            int orderA = a.getDisplayOrder() != null ? a.getDisplayOrder() : 0;
            int orderB = b.getDisplayOrder() != null ? b.getDisplayOrder() : 0;
            if (orderA != orderB) return Integer.compare(orderA, orderB);

            return Long.compare(a.getId() != null ? a.getId() : 0, b.getId() != null ? b.getId() : 0);
        });

        return ResponseEntity.ok(new ResponseData<>(200, "Lấy danh sách danh mục cộng đồng thành công", result));
    }
}
