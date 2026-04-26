package chatToggetther.ENUMS;

public enum WsTopic {
    CHAT_MESSAGES("/topic/messages"),
    NOTIFICATIONS("/topic/notifications"),
    SYSTEM_ALERTS("/topic/alerts");

    private final String path;

    WsTopic(String path) {
        this.path = path;
    }

    public String getPath() {
        return path;
    }
}