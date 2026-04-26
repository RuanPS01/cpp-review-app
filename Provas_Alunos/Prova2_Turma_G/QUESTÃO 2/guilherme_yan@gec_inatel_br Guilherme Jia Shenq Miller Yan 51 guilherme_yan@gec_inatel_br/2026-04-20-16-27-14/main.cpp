#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    int quantidade;
    int N;
    int valores;
    
    // media = soma de todos os numeros % quantidade
    cin >> quantidade;
    cin >> N;
    
    int soma = N + quantidade;
    
    float media = soma % quantidade;
    
    cout << fixed << setprecision(4);
    cout << media << endl;
    
    return 0;
}