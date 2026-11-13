package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CreatePostRequest {
    @NotBlank(message = "Nội dung bài viết không được để trống")
    @Size(max = 4000, message = "Nội dung bài viết tối đa 4000 ký tự")
    private String content;

    @Size(max = 35000000, message = "Dữ liệu đa phương tiện tối đa 25MB")
    private String imageUrl;

    @Size(max = 200, message = "Thẻ chủ đề tối đa 200 ký tự")
    private String vibe;
}
