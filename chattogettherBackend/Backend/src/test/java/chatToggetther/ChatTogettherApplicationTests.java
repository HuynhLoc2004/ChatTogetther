package chatToggetther;

import chatToggetther.modelEntity.PostEntity;
import chatToggetther.modelEntity.UserEntity;
import chatToggetther.repository.PostRepository;
import chatToggetther.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;

@SpringBootTest
class ChatTogettherApplicationTests {

	@Autowired
	private PostRepository postRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private chatToggetther.repository.PostLikeRepository postLikeRepository;

	@Autowired
	private chatToggetther.repository.CommentRepository commentRepository;

	@Test
	void contextLoads() {
		System.out.println(">>> Checking users and posts in database...");
		UserEntity user = userRepository.findAll().stream().findFirst().orElse(null);
		System.out.println(">>> Found user: " + (user != null ? user.getAccount() + " (id=" + user.getId() + ")" : "none"));
		if (user != null) {
			try {
				PostEntity p = new PostEntity();
				p.setUser(user);
				p.setContent("Test post from JUnit");
				p.setCreatedAt(LocalDateTime.now());
				postRepository.save(p);
				System.out.println(">>> Successfully saved test post id=" + p.getId());

				// Test like
				chatToggetther.modelEntity.PostLikeEntity like = new chatToggetther.modelEntity.PostLikeEntity();
				like.setPost(p);
				like.setUser(user);
				like.setReactionType("HEART");
				like.setCreatedAt(LocalDateTime.now());
				postLikeRepository.save(like);
				System.out.println(">>> Successfully saved test like id=" + like.getId());

				int count = postLikeRepository.countByPost(p);
				System.out.println(">>> Likes count: " + count);

				postLikeRepository.delete(like);
				System.out.println(">>> Successfully deleted test like");

				// Test comment
				chatToggetther.modelEntity.CommentEntity c = new chatToggetther.modelEntity.CommentEntity();
				c.setPost(p);
				c.setUser(user);
				c.setContent("Test comment");
				c.setCreatedAt(LocalDateTime.now());
				commentRepository.save(c);
				System.out.println(">>> Successfully saved test comment id=" + c.getId());

				commentRepository.delete(c);
				System.out.println(">>> Successfully deleted test comment");

				postRepository.delete(p);
				System.out.println(">>> Successfully cleaned up test post");
			} catch (Exception e) {
				System.err.println(">>> FAILED TO SAVE POST/LIKE: " + e.getMessage());
				e.printStackTrace();
			}
		}
	}

}
