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
public class CreateCommentRequest {
    @NotBlank(message = "Nội dung phản hồi không được để trống")
    @Size(max = 1000, message = "Nội dung phản hồi tối đa 1000 ký tự")
    private String content;

    private Long parentId;
    private String replyToUser;
}

