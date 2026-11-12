package chatToggetther.DataRequest;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CreateCommentRequest {
    @NotBlank(message = "Nội dung bình luận không được để trống")
    private String content;
}

