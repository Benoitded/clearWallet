// UI state management for popup interface
export interface UITheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
  border: string;
}

export interface UISettings {
  theme: "light" | "dark" | "auto";
  language: string;
  currency: string;
  notifications: boolean;
  animations: boolean;
  compactMode: boolean;
}

export interface UIState {
  theme: UITheme;
  settings: UISettings;
  loading: Set<string>;
  errors: Map<string, string>;
  notifications: Array<{
    id: string;
    type: "success" | "warning" | "error" | "info";
    message: string;
    timestamp: number;
    persistent?: boolean;
  }>;
  modals: Map<string, boolean>;
  tooltips: Map<string, boolean>;
  animations: Map<string, boolean>;
}

export class UIStateManager {
  private static instance: UIStateManager;
  private state: UIState;
  private listeners = new Map<string, Function[]>();

  // Theme definitions
  private readonly lightTheme: UITheme = {
    primary: "#007bff",
    secondary: "#6c757d",
    background: "#ffffff",
    surface: "#f8f9fa",
    text: "#212529",
    textSecondary: "#6c757d",
    success: "#28a745",
    warning: "#ffc107",
    error: "#dc3545",
    border: "#dee2e6",
  };

  private readonly darkTheme: UITheme = {
    primary: "#0d6efd",
    secondary: "#6c757d",
    background: "#1a1a1a",
    surface: "#2d2d2d",
    text: "#ffffff",
    textSecondary: "#adb5bd",
    success: "#198754",
    warning: "#fd7e14",
    error: "#dc3545",
    border: "#495057",
  };

  private constructor() {
    this.state = {
      theme: this.lightTheme,
      settings: {
        theme: "auto",
        language: "en",
        currency: "USD",
        notifications: true,
        animations: true,
        compactMode: false,
      },
      loading: new Set(),
      errors: new Map(),
      notifications: [],
      modals: new Map(),
      tooltips: new Map(),
      animations: new Map(),
    };

    this.initializeTheme();
  }

  static getInstance(): UIStateManager {
    if (!UIStateManager.instance) {
      UIStateManager.instance = new UIStateManager();
    }
    return UIStateManager.instance;
  }

  /**
   * Initialize theme based on system preference
   */
  private initializeTheme(): void {
    if (this.state.settings.theme === "auto") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      this.state.theme = prefersDark ? this.darkTheme : this.lightTheme;

      // Listen for system theme changes
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          if (this.state.settings.theme === "auto") {
            this.setTheme(e.matches ? "dark" : "light");
          }
        });
    }
  }

  // =================== Theme Management ===================

  /**
   * Set theme
   */
  setTheme(theme: "light" | "dark" | "auto"): void {
    this.state.settings.theme = theme;

    if (theme === "auto") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      this.state.theme = prefersDark ? this.darkTheme : this.lightTheme;
    } else {
      this.state.theme = theme === "dark" ? this.darkTheme : this.lightTheme;
    }

    this.applyThemeToDOM();
    this.emit("themeChanged", this.state.theme);
    this.saveSettings();
  }

  /**
   * Get current theme
   */
  getTheme(): UITheme {
    return { ...this.state.theme };
  }

  /**
   * Apply theme to DOM
   */
  private applyThemeToDOM(): void {
    const root = document.documentElement;
    Object.entries(this.state.theme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    root.setAttribute("data-theme", this.state.settings.theme);
  }

  // =================== Settings Management ===================

  /**
   * Update settings
   */
  updateSettings(updates: Partial<UISettings>): void {
    this.state.settings = { ...this.state.settings, ...updates };

    // Apply theme change if needed
    if (updates.theme) {
      this.setTheme(updates.theme);
    }

    this.emit("settingsChanged", this.state.settings);
    this.saveSettings();
  }

  /**
   * Get current settings
   */
  getSettings(): UISettings {
    return { ...this.state.settings };
  }

  /**
   * Save settings to storage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(
        "clearwallet-ui-settings",
        JSON.stringify(this.state.settings)
      );
    } catch (error) {
      console.warn("UIStateManager: Failed to save settings:", error);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<void> {
    try {
      const saved = localStorage.getItem("clearwallet-ui-settings");
      if (saved) {
        const settings = JSON.parse(saved);
        this.updateSettings(settings);
      }
    } catch (error) {
      console.warn("UIStateManager: Failed to load settings:", error);
    }
  }

  // =================== Loading States ===================

  /**
   * Set loading state
   */
  setLoading(key: string, isLoading: boolean): void {
    if (isLoading) {
      this.state.loading.add(key);
    } else {
      this.state.loading.delete(key);
    }

    this.emit("loadingChanged", {
      key,
      isLoading,
      activeLoading: Array.from(this.state.loading),
    });
  }

  /**
   * Check if something is loading
   */
  isLoading(key?: string): boolean {
    if (key) {
      return this.state.loading.has(key);
    }
    return this.state.loading.size > 0;
  }

  /**
   * Get all loading states
   */
  getLoadingStates(): string[] {
    return Array.from(this.state.loading);
  }

  /**
   * Clear all loading states
   */
  clearLoading(): void {
    this.state.loading.clear();
    this.emit("loadingChanged", {
      key: null,
      isLoading: false,
      activeLoading: [],
    });
  }

  // =================== Error Management ===================

  /**
   * Set error
   */
  setError(key: string, error: string | null): void {
    if (error) {
      this.state.errors.set(key, error);
    } else {
      this.state.errors.delete(key);
    }

    this.emit("errorChanged", {
      key,
      error,
      allErrors: Object.fromEntries(this.state.errors),
    });
  }

  /**
   * Get error
   */
  getError(key: string): string | null {
    return this.state.errors.get(key) || null;
  }

  /**
   * Check if has errors
   */
  hasErrors(key?: string): boolean {
    if (key) {
      return this.state.errors.has(key);
    }
    return this.state.errors.size > 0;
  }

  /**
   * Clear error
   */
  clearError(key: string): void {
    this.setError(key, null);
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): void {
    this.state.errors.clear();
    this.emit("errorChanged", {
      key: null,
      error: null,
      allErrors: {},
    });
  }

  // =================== Notification Management ===================

  /**
   * Show notification
   */
  showNotification(
    type: "success" | "warning" | "error" | "info",
    message: string,
    persistent: boolean = false
  ): string {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const notification = {
      id,
      type,
      message,
      timestamp: Date.now(),
      persistent,
    };

    this.state.notifications.push(notification);
    this.emit("notificationAdded", notification);

    // Auto-remove non-persistent notifications
    if (!persistent) {
      setTimeout(
        () => {
          this.removeNotification(id);
        },
        type === "error" ? 5000 : 3000
      );
    }

    return id;
  }

  /**
   * Remove notification
   */
  removeNotification(id: string): void {
    const index = this.state.notifications.findIndex((n) => n.id === id);
    if (index > -1) {
      const notification = this.state.notifications[index];
      this.state.notifications.splice(index, 1);
      this.emit("notificationRemoved", notification);
    }
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    this.state.notifications = [];
    this.emit("notificationsCleared", null);
  }

  /**
   * Get all notifications
   */
  getNotifications(): Array<{
    id: string;
    type: "success" | "warning" | "error" | "info";
    message: string;
    timestamp: number;
    persistent?: boolean;
  }> {
    return [...this.state.notifications];
  }

  // =================== Modal Management ===================

  /**
   * Show modal
   */
  showModal(modalId: string): void {
    this.state.modals.set(modalId, true);
    this.emit("modalChanged", { modalId, isOpen: true });
  }

  /**
   * Hide modal
   */
  hideModal(modalId: string): void {
    this.state.modals.set(modalId, false);
    this.emit("modalChanged", { modalId, isOpen: false });
  }

  /**
   * Toggle modal
   */
  toggleModal(modalId: string): void {
    const isOpen = this.state.modals.get(modalId) || false;
    if (isOpen) {
      this.hideModal(modalId);
    } else {
      this.showModal(modalId);
    }
  }

  /**
   * Check if modal is open
   */
  isModalOpen(modalId: string): boolean {
    return this.state.modals.get(modalId) || false;
  }

  /**
   * Close all modals
   */
  closeAllModals(): void {
    this.state.modals.forEach((_, modalId) => {
      this.state.modals.set(modalId, false);
    });
    this.emit("allModalsChanged", false);
  }

  // =================== Tooltip Management ===================

  /**
   * Show tooltip
   */
  showTooltip(tooltipId: string): void {
    this.state.tooltips.set(tooltipId, true);
    this.emit("tooltipChanged", { tooltipId, isVisible: true });
  }

  /**
   * Hide tooltip
   */
  hideTooltip(tooltipId: string): void {
    this.state.tooltips.set(tooltipId, false);
    this.emit("tooltipChanged", { tooltipId, isVisible: false });
  }

  /**
   * Check if tooltip is visible
   */
  isTooltipVisible(tooltipId: string): boolean {
    return this.state.tooltips.get(tooltipId) || false;
  }

  // =================== Animation Management ===================

  /**
   * Trigger animation
   */
  triggerAnimation(animationId: string, duration: number = 300): void {
    this.state.animations.set(animationId, true);
    this.emit("animationStarted", { animationId, duration });

    setTimeout(() => {
      this.state.animations.set(animationId, false);
      this.emit("animationEnded", { animationId });
    }, duration);
  }

  /**
   * Check if animation is active
   */
  isAnimationActive(animationId: string): boolean {
    return this.state.animations.get(animationId) || false;
  }

  // =================== Utility Methods ===================

  /**
   * Get CSS custom properties for current theme
   */
  getThemeCSS(): string {
    return Object.entries(this.state.theme)
      .map(([key, value]) => `--color-${key}: ${value};`)
      .join("\n");
  }

  /**
   * Apply compact mode styles
   */
  applyCompactMode(isCompact: boolean): void {
    document.documentElement.setAttribute("data-compact", isCompact.toString());
    this.updateSettings({ compactMode: isCompact });
  }

  /**
   * Get responsive breakpoint info
   */
  getBreakpointInfo(): {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    width: number;
    height: number;
  } {
    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      width,
      height,
    };
  }

  // =================== Event System ===================

  /**
   * Subscribe to events
   */
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(
            `UIStateManager: Error in event listener for ${event}:`,
            error
          );
        }
      });
    }
  }

  /**
   * Get current state snapshot
   */
  getState(): {
    theme: UITheme;
    settings: UISettings;
    loadingStates: string[];
    errors: Record<string, string>;
    notifications: any[];
    modals: Record<string, boolean>;
  } {
    return {
      theme: this.getTheme(),
      settings: this.getSettings(),
      loadingStates: this.getLoadingStates(),
      errors: Object.fromEntries(this.state.errors),
      notifications: this.getNotifications(),
      modals: Object.fromEntries(this.state.modals),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.listeners.clear();
    this.state.loading.clear();
    this.state.errors.clear();
    this.state.notifications = [];
    this.state.modals.clear();
    this.state.tooltips.clear();
    this.state.animations.clear();
    console.log("UIStateManager: Cleanup complete");
  }
}
