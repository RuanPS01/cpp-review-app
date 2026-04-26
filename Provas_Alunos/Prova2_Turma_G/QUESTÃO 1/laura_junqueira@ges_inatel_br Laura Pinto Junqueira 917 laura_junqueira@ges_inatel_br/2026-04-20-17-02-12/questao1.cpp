#include <iostream>
#include <cmath>

using namespace std;

int main(){
    //declara o N valores e os numeros
    int N;
    //declarei uumas variaveis paea soma
    int p = 0, n = 0, par = 0, impar = 0;
    //recebe o N
    cin >> N;
    // for para que enquanto N for maior que 0 continuar rodando
    for(int i = 0; i < N; i++){
        // recebe o num
        int num;
        cin >> num;
        //gambiarra para fazer as verifições
        if(num % 2 == 0 || num == 0){
            par = par + 1;
            if(num > 0){
                p = p + 1;
            }else if(num < 0){
                n = n + 1;
            }
        }else if (num % 2 != 0){ 
            impar = impar + 1;
            if(num > 0){
                p = p + 1;
            }else if(num < 0){
                n = n + 1;
            } 
        }
    }
    // printando os valores
    cout << par << " numeros pares\n";
    cout << impar << " numeros impares\n";
    cout << p << " numeros positivos\n";
    cout << n << " numeros negativos";
    
    return 0;
    
}