package chatToggetther.controller;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.modelEntity.CommunityCategoryEntity;
import chatToggetther.modelEntity.CommunityGroupEntity;
import chatToggetther.repository.CommunityCategoryRepository;
import chatToggetther.repository.CommunityGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping({"/api/admin/community-categories", "/api/admin/categories"})
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_AMDIN', 'TL_SYS_SUPERADMIN', 'TL_PERM_ALL', 'ADMIN') or hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminCommunityCategoryController {

    private final CommunityCategoryRepository categoryRepository;
    private final CommunityGroupRepository groupRepository;

    @GetMapping
    public ResponseEntity<ResponseData<List<CommunityCategoryEntity>>> getAllCategories() {
        List<CommunityCategoryEntity> list = this.categoryRepository.findAll();

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
        } catch (Exception ignored) {}

        for (CommunityCategoryEntity cat : list) {
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
        }

        list.sort((a, b) -> {
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

        return ResponseEntity.ok(new ResponseData<>(200, "Lấy danh mục admin thành công", list));
    }

    @PostMapping
    public ResponseEntity<ResponseData<CommunityCategoryEntity>> createCategory(@RequestBody Map<String, Object> body) {
        String name = body.get("name") != null ? body.get("name").toString().trim() : null;
        String slug = body.get("slug") != null ? body.get("slug").toString().trim().toLowerCase() : null;

        if (name == null || name.isEmpty()) {
            throw new AppException(400, "Tên danh mục không được để trống", 400);
        }
        if (slug == null || slug.isEmpty()) {
            slug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        }
        if (this.categoryRepository.existsBySlug(slug)) {
            slug = slug + "-" + System.currentTimeMillis() % 10000;
        }

        Integer displayOrder = body.get("displayOrder") != null ? Integer.valueOf(body.get("displayOrder").toString()) : 0;
        Boolean isActive = body.get("isActive") != null ? Boolean.valueOf(body.get("isActive").toString()) : true;
        Boolean isPinned = body.get("isPinned") != null ? Boolean.valueOf(body.get("isPinned").toString()) : false;
        String source = body.get("source") != null ? body.get("source").toString() : "SYSTEM";
        String status = body.get("status") != null ? body.get("status").toString() : (isActive ? "ACTIVE" : "HIDDEN");
        String iconName = body.get("iconName") != null ? body.get("iconName").toString() : null;
        String description = body.get("description") != null ? body.get("description").toString() : null;

        CommunityCategoryEntity entity = CommunityCategoryEntity.builder()
                .name(name)
                .slug(slug)
                .displayOrder(displayOrder)
                .isActive(isActive)
                .isPinned(isPinned)
                .source(source)
                .status(status)
                .iconName(iconName)
                .description(description)
                .createdAt(LocalDateTime.now())
                .build();

        entity = this.categoryRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Tạo danh mục thành công", entity));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseData<CommunityCategoryEntity>> updateCategory(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> body
    ) {
        CommunityCategoryEntity entity = this.categoryRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Danh mục không tồn tại", 404));

        if (body.containsKey("name") && body.get("name") != null) {
            String oldName = entity.getName();
            String newName = body.get("name").toString().trim();
            entity.setName(newName);

            // Đồng bộ tên nhóm nếu có
            if (!newName.equalsIgnoreCase(oldName)) {
                List<CommunityGroupEntity> groups = this.groupRepository.findByCategoryId(id);
                for (CommunityGroupEntity g : groups) {
                    g.setCategoryName(newName);
                    this.groupRepository.save(g);
                }
            }
        }
        if (body.containsKey("slug") && body.get("slug") != null) {
            String newSlug = body.get("slug").toString().trim().toLowerCase();
            if (!newSlug.equals(entity.getSlug()) && this.categoryRepository.existsBySlug(newSlug)) {
                throw new AppException(400, "Mã định danh (slug) đã tồn tại", 400);
            }
            entity.setSlug(newSlug);
        }
        if (body.containsKey("displayOrder") && body.get("displayOrder") != null) {
            entity.setDisplayOrder(Integer.valueOf(body.get("displayOrder").toString()));
        }
        if (body.containsKey("isActive") && body.get("isActive") != null) {
            boolean active = Boolean.valueOf(body.get("isActive").toString());
            entity.setIsActive(active);
            entity.setStatus(active ? "ACTIVE" : "HIDDEN");
        }
        if (body.containsKey("status") && body.get("status") != null) {
            String st = body.get("status").toString().trim().toUpperCase();
            entity.setStatus(st);
            entity.setIsActive(!"HIDDEN".equals(st));
        }
        if (body.containsKey("isPinned") && body.get("isPinned") != null) {
            entity.setIsPinned(Boolean.valueOf(body.get("isPinned").toString()));
        }
        if (body.containsKey("iconName")) {
            entity.setIconName(body.get("iconName") != null ? body.get("iconName").toString() : null);
        }
        if (body.containsKey("description")) {
            entity.setDescription(body.get("description") != null ? body.get("description").toString() : null);
        }

        entity = this.categoryRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Cập nhật danh mục thành công", entity));
    }

    @PatchMapping("/{id}/pin")
    public ResponseEntity<ResponseData<CommunityCategoryEntity>> togglePinCategory(@PathVariable("id") Long id) {
        CommunityCategoryEntity entity = this.categoryRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Danh mục không tồn tại", 404));
        entity.setIsPinned(!Boolean.TRUE.equals(entity.getIsPinned()));
        entity = this.categoryRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, entity.getIsPinned() ? "Đã ghim chủ đề lên đầu" : "Đã bỏ ghim chủ đề", entity));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<ResponseData<CommunityCategoryEntity>> toggleCategory(@PathVariable("id") Long id) {
        CommunityCategoryEntity entity = this.categoryRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Danh mục không tồn tại", 404));
        boolean newActive = !Boolean.TRUE.equals(entity.getIsActive());
        entity.setIsActive(newActive);
        entity.setStatus(newActive ? "ACTIVE" : "HIDDEN");
        entity = this.categoryRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, newActive ? "Đã hiện chủ đề" : "Đã ẩn chủ đề", entity));
    }

    @PostMapping("/merge")
    @Transactional
    public ResponseEntity<ResponseData<Map<String, Object>>> mergeCategories(@RequestBody Map<String, Object> body) {
        Long sourceId = body.get("sourceCategoryId") != null ? Long.valueOf(body.get("sourceCategoryId").toString()) :
                (body.get("sourceId") != null ? Long.valueOf(body.get("sourceId").toString()) : null);
        Long targetId = body.get("targetCategoryId") != null ? Long.valueOf(body.get("targetCategoryId").toString()) :
                (body.get("targetId") != null ? Long.valueOf(body.get("targetId").toString()) : null);

        if (sourceId == null || targetId == null || sourceId.equals(targetId)) {
            throw new AppException(400, "Vui lòng chọn 2 chủ đề hợp lệ và khác nhau để gộp", 400);
        }

        CommunityCategoryEntity source = this.categoryRepository.findById(sourceId).orElseThrow(() ->
                new AppException(404, "Chủ đề nguồn không tồn tại", 404));
        CommunityCategoryEntity target = this.categoryRepository.findById(targetId).orElseThrow(() ->
                new AppException(404, "Chủ đề đích không tồn tại", 404));

        // Cập nhật tất cả các cộng đồng thuộc chủ đề nguồn sang chủ đề đích
        List<CommunityGroupEntity> allGroups = this.groupRepository.findAll();
        int affectedCount = 0;
        for (CommunityGroupEntity g : allGroups) {
            boolean match = false;
            if (source.getId().equals(g.getCategoryId())) match = true;
            if (source.getSlug() != null && source.getSlug().equalsIgnoreCase(g.getCategoryCode())) match = true;
            if (source.getName() != null && source.getName().equalsIgnoreCase(g.getCategoryName())) match = true;

            if (match) {
                g.setCategoryId(target.getId());
                g.setCategoryCode(target.getSlug());
                g.setCategoryName(target.getName());
                this.groupRepository.save(g);
                affectedCount++;
            }
        }

        // Xóa hoặc ẩn chủ đề nguồn
        this.categoryRepository.delete(source);

        Map<String, Object> res = new HashMap<>();
        res.put("mergedGroupsCount", affectedCount);
        res.put("targetCategory", target);
        return ResponseEntity.ok(new ResponseData<>(200, "Đã gộp thành công " + affectedCount + " cộng đồng vào chủ đề '" + target.getName() + "'", res));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Boolean>> deleteCategory(@PathVariable("id") Long id) {
        CommunityCategoryEntity entity = this.categoryRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Danh mục không tồn tại", 404));
        this.categoryRepository.delete(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Xóa danh mục thành công", true));
    }
}
