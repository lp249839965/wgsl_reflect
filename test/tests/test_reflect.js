import { test, group } from "../test.js";
import { WgslReflect } from "../../src/wgsl_reflect.js";

group("Reflect", function() {
    const shader = `
struct ViewUniforms {
    viewProjection: mat4x4<f32>;
};

struct ModelUniforms {
    model: mat4x4<f32>;
    color: vec4<f32>;
    intensity: f32;
};

@binding(0) @group(0) var<uniform> viewUniforms: ViewUniforms;
@binding(1) @group(0) var<uniform> modelUniforms: ModelUniforms;
@binding(2) @group(0) var u_sampler: sampler;
@binding(3) @group(0) var u_texture: texture_2d<f32>;

struct VertexInput {
    @builtin(position) a_position: vec3<f32>;
    @location(1) a_normal: vec3<f32>;
    @location(2) a_color: vec4<f32>;
    @location(3) a_uv: vec2<f32>;
};

struct VertexOutput {
    @builtin(position) Position: vec4<f32>;
    @location(0) v_position: vec4<f32>;
    @location(1) v_normal: vec3<f32>;
    @location(2) v_color: vec4<f32>;
    @location(3) v_uv: vec2<f32>;
};

@stage(vertex)
fn vertex_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.Position = viewUniforms.viewProjection * modelUniforms.model * vec4<f32>(input.a_position, 1.0);
    output.v_position = output.Position;
    output.v_normal = input.a_normal;
    output.v_color = input.a_color * modelUniforms.color * modelUniforms.intensity;
    output.v_uv = input.a_uv;
    return output;
}

@stage(fragment)
fn frag_main() {}

@stage(compute) @workgroup_size(8,4,1)
fn sorter() { }

@stage(compute) @workgroup_size(8u)
fn reverser() { }

// Using an pipeline-overridable constant.
@override(42) let block_width = 12u;
@stage(compute) @workgroup_size(block_width)
fn shuffler() { }
`;

    const reflect = new WgslReflect(shader);

    test("struct", function(test) {
        test.equals(reflect.structs.length, 4);
    });

    test("uniforms", function(test) {
        test.equals(reflect.uniforms.length, 2);
        test.equals(reflect.uniforms[0].name, "viewUniforms");
        test.equals(reflect.uniforms[0].type.name, "ViewUniforms");
        test.notNull(reflect.getStruct(reflect.uniforms[0].type));
    });

    test("textures", function(test) {
        test.equals(reflect.textures.length, 1);
        test.equals(reflect.textures[0].name, "u_texture");
        test.equals(reflect.textures[0].type.name, "texture_2d");
        test.equals(reflect.textures[0].type.format.name, "f32");
        test.equals(reflect.textures[0].group, 0);
        test.equals(reflect.textures[0].binding, 3);
    });

    test("samplers", function(test) {
        test.equals(reflect.samplers.length, 1);
        test.equals(reflect.samplers[0].name, "u_sampler");
        test.equals(reflect.samplers[0].type.name, "sampler");
        test.equals(reflect.samplers[0].group, 0);
        test.equals(reflect.samplers[0].binding, 2);
    });

    test("uniformBufferInfo", function(test) {
        const buffer = reflect.getUniformBufferInfo(reflect.uniforms[1]);
        test.notNull(buffer);
        test.equals(buffer.type, "uniform", "buffer.type");
        test.equals(buffer.size, 96, "buffer.size");
        test.equals(buffer.group, "0", "buffer.group.value");
        test.equals(buffer.binding, "1", "buffer.binding.value");
        test.equals(buffer.members.length, 3, "buffer.members.length");
        test.equals(buffer.members[0].name, "model", "buffer.members[0].name");
        test.equals(buffer.members[1].name, "color", "buffer.members[1].name");
        test.equals(buffer.members[2].name, "intensity", "buffer.members[1].name");
    });

    test("getBindingGroups", function(test) {
        const groups = reflect.getBindGroups();
        test.equals(groups.length, 1);
        test.equals(groups[0].length, 4);
        test.equals(groups[0][0].type, "buffer");
        test.equals(groups[0][1].type, "buffer");
        test.equals(groups[0][2].type, "sampler");
        test.equals(groups[0][3].type, "texture");
        test.equals(groups[0][3].resource.type.name, "texture_2d");
        test.equals(groups[0][3].resource.type.format.name, "f32");
    });

    test("function", function(test) {
        test.equals(reflect.functions.length, 5);
        test.equals(reflect.functions[0].name, "vertex_main");
        test.equals(reflect.functions[1].name, "frag_main");
        test.equals(reflect.functions[2].name, "sorter");
        test.equals(reflect.functions[3].name, "reverser");
        test.equals(reflect.functions[4].name, "shuffler");
    });

    test("entry", function(test) {
        test.equals(reflect.entry.vertex.length, 1);
        test.equals(reflect.entry.fragment.length, 1);
        test.equals(reflect.entry.compute.length, 3);
    });

    test("vertexInputs", function(test) {
        const inputs = reflect.entry.vertex[0].inputs;
        test.equals(inputs.length, 4);
        test.validateObject(inputs[0], {
            name: "a_position",
            locationType: "builtin",
            location: "position",
            type: { name: "vec3" }
        });

        test.validateObject(inputs[1], {
            name: "a_normal",
            locationType: "location",
            location: 1,
            type: { name: "vec3" }
        });
    });
});
