#include <iostream>
#include <iomanip>
using namespace std;

int main(){
    int n;  
    cin >> n;
    
    int num[1000];
    int soma = 0; 
    
    for(int i = 0; i < n; i++){
        cin >> num[i]; // Quantidade de numeros a serem digitadas
        soma += num[i]; // total
    }
    cout << fixed << setprecision(4) << (double)soma/n << endl; //
    return 0;
}
// Easy