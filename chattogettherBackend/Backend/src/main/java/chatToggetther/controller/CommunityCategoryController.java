package chatToggetther.controller;

import chatToggetther.Customize.ResponseData;
import chatToggetther.modelEntity.CommunityCategoryEntity;
import chatToggetther.repository.CommunityCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({"/api/communities/categories", "/api/groups/categories"})
@RequiredArgsConstructor
public class CommunityCategoryController {

    private final CommunityCategoryRepository categoryRepository;

    @GetMapping
    public ResponseEntity<ResponseData<List<CommunityCategoryEntity>>> getActiveCategories() {
        List<CommunityCategoryEntity> list = this.categoryRepository.findByIsActiveTrueOrderByDisplayOrderAscIdAsc();
        return ResponseEntity.ok(new ResponseData<>(200, "Lấy danh sách danh mục cộng đồng thành công", list));
    }
}
