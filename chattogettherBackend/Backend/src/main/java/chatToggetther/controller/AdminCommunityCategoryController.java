package chatToggetther.controller;

import chatToggetther.Customize.AppException;
import chatToggetther.Customize.ResponseData;
import chatToggetther.modelEntity.CommunityCategoryEntity;
import chatToggetther.repository.CommunityCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/admin/community-categories", "/api/admin/categories"})
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_AMDIN', 'TL_SYS_SUPERADMIN', 'TL_PERM_ALL', 'ADMIN') or hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminCommunityCategoryController {

    private final CommunityCategoryRepository categoryRepository;

    @GetMapping
    public ResponseEntity<ResponseData<List<CommunityCategoryEntity>>> getAllCategories() {
        List<CommunityCategoryEntity> list = this.categoryRepository.findAllByOrderByDisplayOrderAscIdAsc();
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
        String iconName = body.get("iconName") != null ? body.get("iconName").toString() : null;
        String description = body.get("description") != null ? body.get("description").toString() : null;

        CommunityCategoryEntity entity = CommunityCategoryEntity.builder()
                .name(name)
                .slug(slug)
                .displayOrder(displayOrder)
                .isActive(isActive)
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
            entity.setName(body.get("name").toString().trim());
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
            entity.setIsActive(Boolean.valueOf(body.get("isActive").toString()));
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

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<ResponseData<CommunityCategoryEntity>> toggleCategory(@PathVariable("id") Long id) {
        CommunityCategoryEntity entity = this.categoryRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Danh mục không tồn tại", 404));
        entity.setIsActive(!Boolean.TRUE.equals(entity.getIsActive()));
        entity = this.categoryRepository.save(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Đã cập nhật trạng thái danh mục", entity));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseData<Boolean>> deleteCategory(@PathVariable("id") Long id) {
        CommunityCategoryEntity entity = this.categoryRepository.findById(id).orElseThrow(() ->
                new AppException(404, "Danh mục không tồn tại", 404));
        this.categoryRepository.delete(entity);
        return ResponseEntity.ok(new ResponseData<>(200, "Xóa danh mục thành công", true));
    }
}
