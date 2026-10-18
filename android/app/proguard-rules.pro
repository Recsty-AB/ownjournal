# Capacitor discovers plugin methods and permission/activity callbacks through
# reflection. Its consumer rules preserve plugin classes and their entry points;
# R8 full mode also needs the annotation types themselves to remain available.
-keep @interface com.getcapacitor.**
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
