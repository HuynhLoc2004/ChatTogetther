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
				postRepository.delete(p);
				System.out.println(">>> Successfully cleaned up test post");
			} catch (Exception e) {
				System.err.println(">>> FAILED TO SAVE POST: " + e.getMessage());
				e.printStackTrace();
			}
		}
	}

}
